// Admin-only reads and actions. Every change is written to the audit log.
import type { PlatformSettings, RegionId } from '@shared/types'
import type { UserRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest, notFound } from '../lib/errors'
import { nowIso, type AppContext } from '../context'
import { audit, loadAuditLog } from './audit'
import { toTransaction } from './ledger'
import { toOrder } from './purchases'
import { toPromoRequest } from './promo'
import { saveSettings } from './settings'
import { adminUserDto } from './users'
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

export async function setUserSuspended(ctx: AppContext, admin: UserRow, userId: string, suspended: boolean) {
  if (userId === admin.id) throw badRequest('ระงับบัญชีของตัวเองไม่ได้')
  const user = await ctx.db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst()
  if (!user) throw notFound('ไม่พบบัญชีผู้ใช้')
  await ctx.db.updateTable('users').set({ suspended: suspended ? 1 : 0, updated_at: nowIso() }).where('id', '=', userId).execute()
  if (suspended) await ctx.db.deleteFrom('sessions').where('user_id', '=', userId).execute()
  await audit(ctx.db, admin, suspended ? 'ระงับบัญชี' : 'ยกเลิกการระงับบัญชี', user.name)
  return adminUserDto(ctx, { ...user, suspended: suspended ? 1 : 0 })
}

export async function revokeKyc(ctx: AppContext, admin: UserRow, userId: string) {
  const user = await ctx.db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst()
  if (!user) throw notFound('ไม่พบบัญชีผู้ใช้')
  await ctx.db.updateTable('users').set({ is_verified: 0, verified_at: null, updated_at: nowIso() }).where('id', '=', userId).execute()
  await audit(ctx.db, admin, 'เพิกถอนการยืนยันตัวตน (KYC)', user.name)
  return adminUserDto(ctx, { ...user, is_verified: 0, verified_at: null })
}

