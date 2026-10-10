// Accounts: sign-up, login, sessions, profile, KYC (citizen ID + phone OTP).
import { randomInt } from 'node:crypto'
import type { PayoutAccount, User } from '@shared/types'
import { formatCitizenId, isValidCitizenId, isValidThaiMobile, maskCitizenId } from '@shared/identity'
import { activeSignupBonus } from '@shared/settings'
import type { UserRow } from '../db/schema'
import { hashPassword, newId, newToken, sha256, verifyPassword } from '../lib/crypto'
import { sendMail } from '../lib/mail'
import { sendSms } from '../lib/sms'
import { ApiError, badRequest, conflict, forbidden } from '../lib/errors'
import { nowIso, type AppContext } from '../context'
import { creditWallet, recordTransaction } from './ledger'
import { getSettings } from './settings'

export const DEFAULT_AVATAR_URL =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
export const MIN_PASSWORD_LENGTH = 8

export const digits = (value: string) => value.replace(/[^0-9]/g, '')
const formatPhone = (d: string) => (d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d)
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/** An admin whose email is SUPER_ADMIN_EMAIL (being an admin is required: emails aren't verified). */
export function isSuperAdmin(ctx: AppContext, row: Pick<UserRow, 'role' | 'email'>) {
  return row.role === 'admin' && !!ctx.config.superAdminEmail && row.email === ctx.config.superAdminEmail
}

export function citizenIdOf(ctx: AppContext, row: Pick<UserRow, 'citizen_enc'>): string {
  return row.citizen_enc ? ctx.secrets.decrypt(row.citizen_enc) || '' : ''
}

/** The signed-in user's own account (full details, no password). */
export function selfDto(ctx: AppContext, row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    citizenId: formatCitizenId(citizenIdOf(ctx, row)),
    phone: row.phone ? formatPhone(row.phone) : '',
    email: row.email,
    balance: row.balance,
    avatarUrl: row.avatar_url,
    bio: row.bio ?? undefined,
    isVerified: !!row.is_verified,
    verifiedAt: row.verified_at ?? undefined,
    createdAt: row.created_at,
    payoutAccount: row.payout_json ? (JSON.parse(row.payout_json) as PayoutAccount) : undefined,
    role: row.role === 'admin' ? 'admin' : undefined,
    suspended: !!row.suspended || undefined,
    disabled: !!row.disabled || undefined,
    superAdmin: isSuperAdmin(ctx, row) || undefined,
  }
}

/** What an admin sees in the user list: contact details, citizen ID masked. */
export function adminUserDto(ctx: AppContext, row: UserRow): User {
  const self = selfDto(ctx, row)
  return { ...self, citizenId: maskCitizenId(self.citizenId) }
}

export async function findUser(ctx: AppContext, id: string) {
  return ctx.db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst()
}

export async function requireUserRow(ctx: AppContext, id: string) {
  const row = await findUser(ctx, id)
  if (!row) throw new ApiError(401, 'ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่')
  return row
}

// ---------------------------------------------------------------- sign-up & login

export interface SignupInput {
  name: string
  citizenId: string
  phone: string
  email: string
  password: string
}

export async function signup(ctx: AppContext, input: SignupInput): Promise<UserRow> {
  const name = String(input.name ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  const phone = digits(String(input.phone ?? ''))
  const citizen = digits(String(input.citizenId ?? ''))
  const password = String(input.password ?? '')

  if (!name) throw badRequest('กรุณากรอกชื่อ-นามสกุล')
  if (name.length > 120) throw badRequest('ชื่อยาวเกินไป')
  if (!isEmail(email)) throw badRequest('อีเมลไม่ถูกต้อง')
  if (!isValidThaiMobile(phone)) throw badRequest('เบอร์โทรศัพท์ต้องมี 10 หลักและขึ้นต้นด้วย 06, 08 หรือ 09')
  if (!isValidCitizenId(citizen)) throw badRequest('เลขประจำตัวประชาชนไม่ถูกต้องตามสูตรคำนวณของกรมการปกครอง')
  if (password.length < MIN_PASSWORD_LENGTH) throw badRequest(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)

  const citizenHash = ctx.secrets.citizenHash(citizen)
  const taken = await ctx.db
    .selectFrom('users')
    .select(['email', 'phone', 'citizen_hash'])
    .where((eb) => eb.or([eb('email', '=', email), eb('phone', '=', phone), eb('citizen_hash', '=', citizenHash)]))
    .execute()
  if (taken.some((u) => u.citizen_hash === citizenHash)) throw conflict('เลขบัตรประชาชนนี้ถูกลงทะเบียนไว้ในระบบแล้ว')
  if (taken.some((u) => u.phone === phone)) throw conflict('เบอร์โทรศัพท์นี้ถูกใช้งานในระบบแล้ว')
  if (taken.some((u) => u.email === email)) throw conflict('อีเมลนี้ถูกใช้งานในระบบแล้ว')

  const now = nowIso()
  const row: UserRow = {
    id: newId('u'),
    name,
    email,
    phone,
    citizen_hash: citizenHash,
    citizen_enc: ctx.secrets.encrypt(citizen),
    password_hash: await hashPassword(password),
    balance: 0,
    avatar_url: DEFAULT_AVATAR_URL,
    bio: null,
    is_verified: 0,
    verified_at: null,
    role: 'user',
    suspended: 0,
    disabled: 0,
    payout_json: null,
    created_at: now,
    updated_at: now,
  }
  const bonus = activeSignupBonus(await getSettings(ctx))
  await ctx.db.transaction().execute(async (trx) => {
    await trx.insertInto('users').values(row).execute()
    if (bonus <= 0) return
    await creditWallet(trx, row.id, bonus)
    await recordTransaction(trx, {
      windowId: 0,
      windowCode: 'BONUS',
      region: 'thailand',
      windowTitle: 'โบนัสสมัครสมาชิก',
      fromOwner: '500 Windows',
      toOwner: name,
      toOwnerId: row.id,
      amount: bonus,
      type: 'bonus',
      walletAmount: 0,
      externalAmount: 0,
    })
  })
  return { ...row, balance: bonus }
}

/** Login by email, phone or citizen ID. Same message for unknown account and wrong password. */
export async function login(ctx: AppContext, identifier: string, password: string): Promise<UserRow> {
  const query = String(identifier ?? '').trim().toLowerCase()
  const d = digits(query)
  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where((eb) => {
      const options = [eb('email', '=', query)]
      if (d.length === 10) options.push(eb('phone', '=', d))
      if (d.length === 13) options.push(eb('citizen_hash', '=', ctx.secrets.citizenHash(d)))
      return eb.or(options)
    })
    .executeTakeFirst()
  const ok = row ? await verifyPassword(String(password ?? ''), row.password_hash) : false
  if (!row || !ok) throw new ApiError(401, 'อีเมล/เบอร์โทร/เลขบัตร หรือรหัสผ่านไม่ถูกต้อง')
  if (row.disabled) throw forbidden('บัญชีนี้ถูกปิดใช้งานโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน')
  return row
}

export async function changePassword(ctx: AppContext, user: UserRow, current: string, next: string) {
  if (!(await verifyPassword(String(current ?? ''), user.password_hash))) throw badRequest('รหัสผ่านปัจจุบันไม่ถูกต้อง')
  if (String(next ?? '').length < MIN_PASSWORD_LENGTH) throw badRequest(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)
  await ctx.db
    .updateTable('users')
    .set({ password_hash: await hashPassword(next), updated_at: nowIso() })
    .where('id', '=', user.id)
    .execute()
}

// ---------------------------------------------------------------- forgot password

const RESET_TTL_MS = 15 * 60_000
const RESET_MAX_ATTEMPTS = 5
const resetHash = (userId: string, code: string) => sha256(`reset:${userId}:${code}`)
const BAD_RESET_CODE = 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่'

/**
 * Emails a 6-digit code for setting a new password. Answers the same whether or not the email
 * has an account, so it can't be used to find out who is registered. Without SMTP outside
 * production, returns the code to the app instead.
 */
export async function requestPasswordReset(ctx: AppContext, emailInput: string): Promise<{ devCode?: string }> {
  const email = String(emailInput ?? '').trim().toLowerCase()
  if (!isEmail(email)) throw badRequest('อีเมลไม่ถูกต้อง')
  const devMode = !ctx.config.isProduction && !ctx.config.mail.host
  // Checked before the lookup, so a missing mail setup shows the same for every address.
  if (!devMode && !ctx.config.mail.host) throw new ApiError(503, 'ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
  const user = await ctx.db.selectFrom('users').select(['id', 'name', 'disabled']).where('email', '=', email).executeTakeFirst()
  if (!user || user.disabled) return {}

  const code = String(randomInt(100000, 1000000))
  const values = { code_hash: resetHash(user.id, code), expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(), attempts: 0 }
  await ctx.db.deleteFrom('password_resets').where('user_id', '=', user.id).execute()
  await ctx.db.insertInto('password_resets').values({ user_id: user.id, ...values }).execute()
  if (devMode) return { devCode: code }
  try {
    await sendMail(
      ctx.config.mail,
      email,
      'รหัสตั้งรหัสผ่านใหม่ 500 Windows',
      [
        `สวัสดีคุณ ${user.name}`,
        '',
        `รหัสสำหรับตั้งรหัสผ่านใหม่ของคุณคือ ${code}`,
        'รหัสนี้ใช้ได้ 15 นาที ห้ามบอกรหัสนี้กับผู้อื่น',
        '',
        'ถ้าคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ',
        '',
        '500 Windows to Thailand',
      ].join('\n'),
    )
  } catch (err) {
    await ctx.db.deleteFrom('password_resets').where('user_id', '=', user.id).execute()
    throw err
  }
  return {}
}

/** Sets a new password with the emailed code, and signs the account out everywhere. */
export async function resetPassword(ctx: AppContext, input: { email: string; code: string; password: string }) {
  const email = String(input.email ?? '').trim().toLowerCase()
  const password = String(input.password ?? '')
  if (password.length < MIN_PASSWORD_LENGTH) throw badRequest(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`)
  const user = await ctx.db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst()
  const reset = user && (await ctx.db.selectFrom('password_resets').selectAll().where('user_id', '=', user.id).executeTakeFirst())
  if (!user || !reset || reset.expires_at < nowIso()) throw badRequest(BAD_RESET_CODE)
  if (reset.attempts >= RESET_MAX_ATTEMPTS) throw new ApiError(429, 'กรอกรหัสผิดหลายครั้ง กรุณาขอรหัสใหม่')
  if (reset.code_hash !== resetHash(user.id, String(input.code ?? '').trim())) {
    await ctx.db.updateTable('password_resets').set({ attempts: reset.attempts + 1 }).where('user_id', '=', user.id).execute()
    throw badRequest('รหัสยืนยันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
  }
  await ctx.db.updateTable('users').set({ password_hash: await hashPassword(password), updated_at: nowIso() }).where('id', '=', user.id).execute()
  await ctx.db.deleteFrom('password_resets').where('user_id', '=', user.id).execute()
  await ctx.db.deleteFrom('sessions').where('user_id', '=', user.id).execute()
}

// ---------------------------------------------------------------- sessions

export async function createSession(ctx: AppContext, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken()
  const expiresAt = new Date(Date.now() + ctx.config.sessionDays * 86_400_000)
  await ctx.db
    .insertInto('sessions')
    .values({ id: sha256(token), user_id: userId, created_at: nowIso(), expires_at: expiresAt.toISOString() })
    .execute()
  return { token, expiresAt }
}

export async function userForSession(ctx: AppContext, token: string): Promise<UserRow | null> {
  const row = await ctx.db
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .selectAll('users')
    .where('sessions.id', '=', sha256(token))
    .where('sessions.expires_at', '>', nowIso())
    .where('users.disabled', '=', 0)
    .executeTakeFirst()
  return row ?? null
}

export async function deleteSession(ctx: AppContext, token: string) {
  await ctx.db.deleteFrom('sessions').where('id', '=', sha256(token)).execute()
}

// ---------------------------------------------------------------- profile

export interface ProfileInput {
  name?: string
  bio?: string
  /** Changing the email (used for login and password reset) needs the current password. */
  email?: string
  currentPassword?: string
  payoutAccount?: PayoutAccount
}

export async function updateProfile(ctx: AppContext, user: UserRow, input: ProfileInput): Promise<UserRow> {
  const changes: Partial<UserRow> = { updated_at: nowIso() }
  if (input.name !== undefined) {
    const name = String(input.name).trim()
    if (!name || name.length > 120) throw badRequest('ชื่อต้องไม่ว่างและยาวไม่เกิน 120 ตัวอักษร')
    changes.name = name
  }
  if (input.bio !== undefined) changes.bio = String(input.bio).trim().slice(0, 500) || null
  if (input.email !== undefined) {
    const email = String(input.email).trim().toLowerCase()
    if (email !== user.email) {
      if (!isEmail(email)) throw badRequest('อีเมลไม่ถูกต้อง')
      if (!(await verifyPassword(String(input.currentPassword ?? ''), user.password_hash))) {
        throw badRequest('กรุณากรอกรหัสผ่านปัจจุบันให้ถูกต้องเพื่อเปลี่ยนอีเมล')
      }
      const taken = await ctx.db.selectFrom('users').select('id').where('email', '=', email).where('id', '!=', user.id).executeTakeFirst()
      if (taken) throw conflict('อีเมลนี้ถูกใช้งานในระบบแล้ว')
      changes.email = email
    }
  }
  if (input.payoutAccount !== undefined) changes.payout_json = JSON.stringify(cleanPayoutAccount(input.payoutAccount))
  await ctx.db.updateTable('users').set(changes).where('id', '=', user.id).execute()
  return { ...user, ...changes }
}

function cleanPayoutAccount(account: PayoutAccount): PayoutAccount {
  const type = account?.type === 'bank' ? 'bank' : 'promptpay'
  const accountNumber = String(account?.accountNumber ?? '').trim().slice(0, 40)
  const accountName = String(account?.accountName ?? '').trim().slice(0, 120)
  if (!accountNumber || !accountName) throw badRequest('กรุณากรอกเลขบัญชีและชื่อบัญชีให้ครบ')
  return {
    type,
    promptpayType: type === 'promptpay' ? (account.promptpayType === 'citizenId' ? 'citizenId' : 'phone') : undefined,
    bankCode: type === 'bank' ? String(account.bankCode ?? '').slice(0, 20) : undefined,
    bankName: type === 'bank' ? String(account.bankName ?? '').slice(0, 80) : undefined,
    accountNumber,
    accountName,
    autoPayout: !!account.autoPayout,
    // Verified by an admin when the first payout goes through, never by the client.
    isVerified: false,
    updatedAt: nowIso(),
  }
}

// ---------------------------------------------------------------- KYC

const OTP_TTL_MS = 5 * 60_000
const OTP_MAX_ATTEMPTS = 5
const otpHash = (userId: string, code: string) => sha256(`${userId}:${code}`)

/** Sends (or in dev mode, returns) a 6-digit OTP for the phone number. */
export async function requestOtp(ctx: AppContext, user: UserRow, phoneInput: string): Promise<{ devCode?: string }> {
  const phone = digits(String(phoneInput ?? ''))
  if (!isValidThaiMobile(phone)) throw badRequest('เบอร์โทรศัพท์ต้องมี 10 หลักและขึ้นต้นด้วย 06, 08 หรือ 09')
  const other = await ctx.db.selectFrom('users').select('id').where('phone', '=', phone).where('id', '!=', user.id).executeTakeFirst()
  if (other) throw conflict('เบอร์โทรศัพท์นี้ผูกกับบัญชีอื่นแล้ว')

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const values = { phone, code_hash: otpHash(user.id, code), expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(), attempts: 0 }
  await ctx.db.deleteFrom('otp_codes').where('user_id', '=', user.id).execute()
  await ctx.db.insertInto('otp_codes').values({ user_id: user.id, ...values }).execute()
  // OTP_MODE=dev returns the code so the app can show it instead of sending an SMS.
  if (ctx.config.otpMode === 'dev') return { devCode: code }
  try {
    await sendSms(ctx.config.sms, phone, `ใช้ OTP ${code} ยืนยันตัวตนใน 500Windows`)
  } catch (err) {
    await ctx.db.deleteFrom('otp_codes').where('user_id', '=', user.id).execute()
    throw err
  }
  return {}
}

function checkIdentity(citizenInput: unknown, phoneInput: unknown) {
  const citizen = digits(String(citizenInput ?? ''))
  const phone = digits(String(phoneInput ?? ''))
  if (citizen.length !== 13) throw badRequest('เลขบัตรประชาชนต้องมี 13 หลัก')
  if (!isValidCitizenId(citizen)) throw badRequest('เลขประจำตัวประชาชนไม่ถูกต้องตามสูตรคำนวณของกรมการปกครอง')
  if (!isValidThaiMobile(phone)) throw badRequest('เบอร์โทรศัพท์ต้องมี 10 หลักและขึ้นต้นด้วย 06, 08 หรือ 09')
  return { citizen, phone }
}

/** Marks the user verified with this citizen ID and phone, unless another account holds either. */
export async function markVerified(ctx: AppContext, user: UserRow, citizenInput: unknown, phoneInput: unknown): Promise<UserRow> {
  const { citizen, phone } = checkIdentity(citizenInput, phoneInput)
  const citizenHash = ctx.secrets.citizenHash(citizen)
  const other = await ctx.db
    .selectFrom('users')
    .select('id')
    .where('id', '!=', user.id)
    .where((eb) => eb.or([eb('citizen_hash', '=', citizenHash), eb('phone', '=', phone)]))
    .executeTakeFirst()
  if (other) throw conflict('เลขบัตรประชาชนหรือเบอร์โทรนี้ผูกกับบัญชีอื่นแล้วในระบบ')

  const changes = {
    citizen_hash: citizenHash,
    citizen_enc: ctx.secrets.encrypt(citizen),
    phone,
    is_verified: 1,
    verified_at: nowIso(),
    updated_at: nowIso(),
  }
  await ctx.db.updateTable('users').set(changes).where('id', '=', user.id).execute()
  await ctx.db.deleteFrom('otp_codes').where('user_id', '=', user.id).execute()
  return { ...user, ...changes }
}

export async function verifyKyc(ctx: AppContext, user: UserRow, input: { citizenId: string; phone: string; otp: string }) {
  const { phone } = checkIdentity(input.citizenId, input.phone)

  const otp = await ctx.db.selectFrom('otp_codes').selectAll().where('user_id', '=', user.id).executeTakeFirst()
  if (!otp || otp.phone !== phone) throw badRequest('กรุณากดขอรหัส OTP สำหรับเบอร์นี้ก่อน')
  if (otp.expires_at < nowIso()) throw badRequest('รหัส OTP หมดอายุ กรุณาขอรหัสใหม่')
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, 'กรอกรหัส OTP ผิดหลายครั้ง กรุณาขอรหัสใหม่')
  if (otp.code_hash !== otpHash(user.id, String(input.otp ?? '').trim())) {
    await ctx.db.updateTable('otp_codes').set({ attempts: otp.attempts + 1 }).where('user_id', '=', user.id).execute()
    throw badRequest('รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
  }
  return markVerified(ctx, user, input.citizenId, input.phone)
}

/** Throws unless the user may buy, sell or claim (not suspended, KYC done). */
export function assertCanTrade(user: UserRow) {
  if (user.suspended) throw forbidden('บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน')
  if (!user.is_verified) {
    throw forbidden(
      'ตามข้อบังคับระบบ: หากจะทำการซื้อหรือขายต่อ ต้องยืนยันตัวตนด้วยเลขบัตรประชาชน 13 หลักและเบอร์โทรศัพท์เท่านั้น',
      { requiresKYC: true },
    )
  }
}
