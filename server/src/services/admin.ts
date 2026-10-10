// Admin-only reads and actions. Every change is written to the audit log.
import type { PlatformSettings, RegionId } from '@shared/types'
import { isValidCitizenId, isValidThaiMobile } from '@shared/identity'
import type { UserRow } from '../db/schema'
import { hashPassword, newId } from '../lib/crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { smsStatus } from '../lib/sms'
import { nowIso, type AppContext } from '../context'
import { audit, loadAuditLog } from './audit'
import { toTransaction } from './ledger'
import { toOrder } from './purchases'
import { toPromoRequest } from './promo'
import { saveSettings } from './settings'
import { adminUserDto, citizenIdOf, DEFAULT_AVATAR_URL, digits, isEmail, isSuperAdmin, markVerified, MIN_PASSWORD_LENGTH } from './users'
import { LINE_ID, lineLastFailure, lineRecipients, saveLineRecipients, savedLineRecipients, sendLineAlert } from './notify'
import { emptyWindowRow, loadBoards, loadWindow } from './windows'

/** Everything the admin pages show. */
export async function adminOverview(ctx: AppContext) {
  const [users, windows, transactions, promoRequests, orders, auditLog] = await Promise.all([
    ctx.db.selectFrom('users').selectAll().orderBy('created_at', 'asc').execute(),
    loadBoards(ctx, null),
    ctx.db.selectFrom('transactions').selectAll().orderBy('date', 'desc').limit(1000).execute(),
    ctx.db.selectFrom('promo_requests').selectAll().orderBy('created_at', 'desc').execute(),
    ctx.db.selectFrom('payment_orders').selectAll().orderBy('created_at', 'desc').limit(1000).execute(),
    loadAuditLog(ctx.db),
  ])
  const names = new Map(users.map((u) => [u.id, u.name]))
  return {
    users: users.map((u) => adminUserDto(ctx, u)),
    windows,
    transactions: transactions.map(toTransaction),
    promoRequests: promoRequests.map(toPromoRequest),
    orders: orders.map((o) => toOrder(o, names.get(o.user_id) ?? '')),
    auditLog,
  }
}

export async function updateSettings(ctx: AppContext, admin: UserRow, settings: PlatformSettings, what: string) {
  const saved = await saveSettings(ctx, settings)
  await audit(ctx.db, admin, 'แก้ไขการตั้งค่า', String(what || 'การตั้งค่าระบบ').slice(0, 200))
  return saved
}

const requireReason = (reason: unknown) => {
  const text = String(reason ?? '').trim().slice(0, 300)
  if (!text) throw badRequest('กรุณาระบุเหตุผล')
  return text
}

/** Content moderation: removes the image and text (rule 5) but keeps the owner. */
export async function takeDownContent(ctx: AppContext, admin: UserRow, region: RegionId, num: number, reasonInput: string) {
  const reason = requireReason(reasonInput)
  const row = await ctx.db.selectFrom('windows').select(['code', 'owner_id']).where('region', '=', region).where('num', '=', num).executeTakeFirst()
  if (!row) throw notFound('ไม่พบบานหน้าต่าง')
  if (!row.owner_id) throw badRequest('บานนี้ยังไม่มีเจ้าของ')
  await ctx.db
    .updateTable('windows')
    .set({
      image_url: '',
      title: `เนื้อหาถูกระงับโดยผู้ดูแลระบบ (${row.code})`,
      description: `เนื้อหาของบานนี้ถูกถอดออกเนื่องจากขัดต่อเงื่อนไขการใช้งาน: ${reason}`,
      external_link: null,
      note_day: null,
      note_text: null,
      note_at: null,
      updated_at: nowIso(),
    })
    .where('region', '=', region)
    .where('num', '=', num)
    .execute()
  await audit(ctx.db, admin, 'ถอดเนื้อหาบาน', `${row.code} · ${reason}`)
  return loadWindow(ctx, region, num, null)
}

/** Returns a window to the pool as an empty, available window (ownership is removed). */
export async function releaseWindow(ctx: AppContext, admin: UserRow, region: RegionId, num: number, reasonInput: string) {
  const reason = requireReason(reasonInput)
  const row = await ctx.db
    .selectFrom('windows')
    .leftJoin('users', 'users.id', 'windows.owner_id')
    .select(['windows.code', 'windows.owner_id', 'windows.previous_owner_id', 'windows.reserved_order_id', 'users.name'])
    .where('windows.region', '=', region)
    .where('windows.num', '=', num)
    .executeTakeFirst()
  if (!row) throw notFound('ไม่พบบานหน้าต่าง')
  if (row.reserved_order_id) throw badRequest('บานนี้มีรายการชำระเงินรอตรวจสอบ กรุณาพิจารณาสลิปก่อน')
  const now = nowIso()
  await ctx.db.transaction().execute(async (trx) => {
    const { region: _r, num: _n, ...empty } = emptyWindowRow(region, num, now)
    await trx
      .updateTable('windows')
      .set({ ...empty, previous_owner_id: row.owner_id || row.previous_owner_id })
      .where('region', '=', region)
      .where('num', '=', num)
      .execute()
    if (row.owner_id) {
      await trx
        .insertInto('window_owners')
        .values({ id: newId('wo'), region, num, owner_id: row.owner_id, transferred_at: now, type: 'released' })
        .execute()
    }
    await trx.deleteFrom('window_follows').where('region', '=', region).where('num', '=', num).execute()
    await audit(trx, admin, 'คืนบานเป็นบานว่าง', `${row.code} (เจ้าของเดิม ${row.name ?? '-'}) · ${reason}`)
  })
  return loadWindow(ctx, region, num, null)
}

function assertSuperAdmin(ctx: AppContext, admin: UserRow) {
  if (!isSuperAdmin(ctx, admin)) throw forbidden('เฉพาะ Super Admin เท่านั้น')
}

/** Super admin only: how LINE alerts to the finance admin are set up (never returns the token). */
export async function lineStatus(ctx: AppContext, admin: UserRow) {
  assertSuperAdmin(ctx, admin)
  const { token, secret, to } = ctx.config.line
  const saved = await savedLineRecipients(ctx)
  const recipients = await lineRecipients(ctx)
  return {
    configured: !!token && recipients.length > 0,
    hasToken: !!token,
    hasSecret: !!secret,
    recipients: recipients.length,
    fromEnv: to.length,
    saved,
    lastFailure: lineLastFailure(),
  }
}

/** Super admin only: the LINE IDs (from the bot's reply to "id") that receive alerts. */
export async function setLineRecipients(ctx: AppContext, admin: UserRow, input: unknown) {
  assertSuperAdmin(ctx, admin)
  const ids = [...new Set((Array.isArray(input) ? input : []).map((id) => String(id).trim()).filter(Boolean))]
  const bad = ids.find((id) => !LINE_ID.test(id))
  if (bad) throw badRequest(`ID ไม่ถูกต้อง: ${bad.slice(0, 40)} (ต้องขึ้นต้นด้วย U, C หรือ R ตามด้วยตัวอักษร 32 ตัว)`)
  if (ids.length > 10) throw badRequest('ใส่ผู้รับได้ไม่เกิน 10 ราย')
  await saveLineRecipients(ctx, ids)
  await audit(ctx.db, admin, 'ตั้งผู้รับแจ้งเตือน LINE', `${ids.length} ราย`)
  return lineStatus(ctx, admin)
}

/** Super admin only: sends a test alert so the admin can check that it arrives. */
export async function testLineAlert(ctx: AppContext, admin: UserRow) {
  assertSuperAdmin(ctx, admin)
  const recipients = await lineRecipients(ctx)
  if (!ctx.config.line.token) throw badRequest('ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN')
  if (!recipients.length) throw badRequest('ยังไม่มีผู้รับแจ้งเตือน กรุณาใส่ LINE ID ก่อน')
  const failures = await sendLineAlert(ctx, `✅ ทดสอบการแจ้งเตือนจาก 500 Windows\nส่งโดย ${admin.name}\nถ้าได้รับข้อความนี้ แปลว่าจะได้รับแจ้งเตือนเมื่อมีสลิปรอตรวจ`)
  if (failures.length) throw badRequest(`ส่ง LINE ไม่สำเร็จ: ${failures.map((f) => f.error).join(' · ')}`)
  return { sent: recipients.length }
}
/** Super admin only: whether THSMS accepts the token, its credit, and the last refusal. */
export async function smsDiagnostics(ctx: AppContext, admin: UserRow) {
  assertSuperAdmin(ctx, admin)
  return { otpMode: ctx.config.otpMode, ...(await smsStatus(ctx.config.sms)) }
}

/** Loads a user that admins may act on: anyone but the super admin. */
async function managedUser(ctx: AppContext, userId: string) {
  const user = await ctx.db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst()
  if (!user) throw notFound('ไม่พบบัญชีผู้ใช้')
  if (isSuperAdmin(ctx, user)) throw forbidden('บัญชี Super Admin เปลี่ยนแปลงไม่ได้')
  return user
}

export interface NewUserInput {
  name: string
  email: string
  password: string
  role: 'admin' | 'user'
}

/** Super admin only: an account that logs in with email and password (KYC still needed to trade). */
export async function createUser(ctx: AppContext, admin: UserRow, input: NewUserInput) {
  assertSuperAdmin(ctx, admin)
  const name = String(input.name ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  const password = String(input.password ?? '')
  const role = input.role === 'admin' ? 'admin' : 'user'
  if (!name) throw badRequest('กรุณากรอกชื่อ')
  if (name.length > 120) throw badRequest('ชื่อยาวเกินไป')
  if (!isEmail(email)) throw badRequest('อีเมลไม่ถูกต้อง')
  if (password.length < MIN_PASSWORD_LENGTH) throw badRequest(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)
  if (await ctx.db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst()) {
    throw conflict('อีเมลนี้ถูกใช้งานในระบบแล้ว')
  }
  const now = nowIso()
  const row: UserRow = {
    id: newId('u'),
    name,
    email,
    phone: null,
    citizen_hash: null,
    citizen_enc: null,
    password_hash: await hashPassword(password),
    balance: 0,
    avatar_url: DEFAULT_AVATAR_URL,
    bio: null,
    is_verified: 0,
    verified_at: null,
    role,
    suspended: 0,
    disabled: 0,
    payout_json: null,
    created_at: now,
    updated_at: now,
  }
  await ctx.db.insertInto('users').values(row).execute()
  await audit(ctx.db, admin, 'สร้างผู้ใช้', `${name} (${email})${role === 'admin' ? ' · ผู้ดูแลระบบ' : ''}`)
  return adminUserDto(ctx, row)
}

export async function setUserSuspended(ctx: AppContext, admin: UserRow, userId: string, suspended: boolean) {
  if (userId === admin.id) throw badRequest('ระงับบัญชีของตัวเองไม่ได้')
  const user = await managedUser(ctx, userId)
  await ctx.db.updateTable('users').set({ suspended: suspended ? 1 : 0, updated_at: nowIso() }).where('id', '=', userId).execute()
  if (suspended) await ctx.db.deleteFrom('sessions').where('user_id', '=', userId).execute()
  await audit(ctx.db, admin, suspended ? 'ระงับบัญชี' : 'ยกเลิกการระงับบัญชี', user.name)
  return adminUserDto(ctx, { ...user, suspended: suspended ? 1 : 0 })
}

/** Disabled accounts cannot log in; their sessions end immediately. */
export async function setUserDisabled(ctx: AppContext, admin: UserRow, userId: string, disabled: boolean) {
  if (userId === admin.id) throw badRequest('ปิดใช้งานบัญชีของตัวเองไม่ได้')
  const user = await managedUser(ctx, userId)
  await ctx.db.updateTable('users').set({ disabled: disabled ? 1 : 0, updated_at: nowIso() }).where('id', '=', userId).execute()
  if (disabled) await ctx.db.deleteFrom('sessions').where('user_id', '=', userId).execute()
  await audit(ctx.db, admin, disabled ? 'ปิดใช้งานบัญชี' : 'เปิดใช้งานบัญชี', user.name)
  return adminUserDto(ctx, { ...user, disabled: disabled ? 1 : 0 })
}

/**
 * Super admin only: makes a user an admin, or an admin a regular user. Nobody can change or
 * disable the super admin, so there is always an active admin.
 */
export async function setUserRole(ctx: AppContext, admin: UserRow, userId: string, role: 'admin' | 'user') {
  assertSuperAdmin(ctx, admin)
  if (role !== 'admin' && role !== 'user') throw badRequest('สิทธิ์ไม่ถูกต้อง')
  if (userId === admin.id) throw badRequest('เปลี่ยนสิทธิ์ของตัวเองไม่ได้')
  const user = await managedUser(ctx, userId)
  if (user.role === role) return adminUserDto(ctx, user)
  // Admins hold no money of their own.
  if (role === 'admin' && user.balance > 0) {
    throw badRequest(`${user.name} ยังมียอดเงินในกระเป๋า ฿${user.balance.toLocaleString()} ต้องเป็น 0 ก่อนจึงจะตั้งเป็นผู้ดูแลระบบได้`)
  }
  await ctx.db.updateTable('users').set({ role, updated_at: nowIso() }).where('id', '=', userId).execute()
  await audit(ctx.db, admin, 'เปลี่ยนสิทธิ์ผู้ใช้', `${user.name} → ${role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้ทั่วไป'}`)
  return adminUserDto(ctx, { ...user, role })
}

export interface UserInfoInput {
  name: string
  email: string
  phone: string
  /** Empty keeps the citizen ID on file (admins only ever see it masked). */
  citizenId?: string
  bio?: string
  /** Empty keeps the current password. */
  password?: string
}

/** Super admin only: edits a user's account details; a new password signs the user out everywhere. */
export async function updateUserInfo(ctx: AppContext, admin: UserRow, userId: string, input: UserInfoInput) {
  assertSuperAdmin(ctx, admin)
  const user = await managedUser(ctx, userId)
  const name = String(input.name ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  const phone = digits(String(input.phone ?? '')) || null
  const citizen = digits(String(input.citizenId ?? ''))
  const bio = String(input.bio ?? '').trim().slice(0, 500) || null
  const password = String(input.password ?? '')
  if (!name) throw badRequest('กรุณากรอกชื่อ')
  if (name.length > 120) throw badRequest('ชื่อยาวเกินไป')
  if (!isEmail(email)) throw badRequest('อีเมลไม่ถูกต้อง')
  if (phone && !isValidThaiMobile(phone)) throw badRequest('เบอร์โทรศัพท์ต้องมี 10 หลักและขึ้นต้นด้วย 06, 08 หรือ 09')
  if (!phone && user.is_verified) throw badRequest('ผู้ใช้ที่ยืนยันตัวตนแล้วต้องมีเบอร์โทรศัพท์')
  if (citizen && !isValidCitizenId(citizen)) throw badRequest('เลขประจำตัวประชาชนไม่ถูกต้องตามสูตรคำนวณของกรมการปกครอง')
  if (password && password.length < MIN_PASSWORD_LENGTH) throw badRequest(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)

  const citizenHash = citizen ? ctx.secrets.citizenHash(citizen) : null
  const taken = await ctx.db
    .selectFrom('users')
    .select(['email', 'phone', 'citizen_hash'])
    .where('id', '!=', user.id)
    .where((eb) => {
      const checks = [eb('email', '=', email)]
      if (phone) checks.push(eb('phone', '=', phone))
      if (citizenHash) checks.push(eb('citizen_hash', '=', citizenHash))
      return eb.or(checks)
    })
    .execute()
  if (citizenHash && taken.some((u) => u.citizen_hash === citizenHash)) throw conflict('เลขบัตรประชาชนนี้ผูกกับบัญชีอื่นแล้วในระบบ')
  if (phone && taken.some((u) => u.phone === phone)) throw conflict('เบอร์โทรศัพท์นี้ผูกกับบัญชีอื่นแล้วในระบบ')
  if (taken.some((u) => u.email === email)) throw conflict('อีเมลนี้ถูกใช้งานในระบบแล้ว')

  const changes: Partial<UserRow> = { name, email, phone, bio, updated_at: nowIso() }
  if (citizen) Object.assign(changes, { citizen_hash: citizenHash, citizen_enc: ctx.secrets.encrypt(citizen) })
  if (password) changes.password_hash = await hashPassword(password)
  const changed = [
    name !== user.name && 'ชื่อ',
    email !== user.email && 'อีเมล',
    phone !== user.phone && 'เบอร์โทรศัพท์',
    citizen && citizen !== citizenIdOf(ctx, user) && 'เลขบัตรประชาชน',
    bio !== user.bio && 'แนะนำตัว',
    password && 'รหัสผ่าน',
  ].filter(Boolean)
  await ctx.db.updateTable('users').set(changes).where('id', '=', user.id).execute()
  if (password) await ctx.db.deleteFrom('sessions').where('user_id', '=', user.id).execute()
  if (changed.length) await audit(ctx.db, admin, 'แก้ไขข้อมูลผู้ใช้', `${name} · ${changed.join(', ')}`)
  return adminUserDto(ctx, { ...user, ...changes })
}

export async function revokeKyc(ctx: AppContext, admin: UserRow, userId: string) {
  const user = await ctx.db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst()
  if (!user) throw notFound('ไม่พบบัญชีผู้ใช้')
  await ctx.db.updateTable('users').set({ is_verified: 0, verified_at: null, updated_at: nowIso() }).where('id', '=', userId).execute()
  await audit(ctx.db, admin, 'เพิกถอนการยืนยันตัวตน (KYC)', user.name)
  return adminUserDto(ctx, { ...user, is_verified: 0, verified_at: null })
}

/** Super admin verifies a user's KYC without OTP, using the citizen ID and phone already on the account. */
export async function verifyUserKyc(ctx: AppContext, admin: UserRow, userId: string) {
  assertSuperAdmin(ctx, admin)
  const user = await managedUser(ctx, userId)
  const citizenId = citizenIdOf(ctx, user)
  const phone = user.phone || ''
  const missing = [!citizenId && 'เลขบัตรประชาชน', !phone && 'เบอร์โทรศัพท์'].filter(Boolean)
  if (missing.length) throw badRequest(`ข้อมูลไม่ครบ (ไม่มี${missing.join('และ')}) ยืนยันตัวตนไม่ได้`)
  const verified = await markVerified(ctx, user, citizenId, phone)
  await audit(ctx.db, admin, 'ยืนยันตัวตน (KYC) ให้ผู้ใช้', user.name)
  return adminUserDto(ctx, verified)
}

