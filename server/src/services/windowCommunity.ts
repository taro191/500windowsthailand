// The owner's daily updates, and "Friend and Co": other windows asking to be linked from this one.
// Both belong to the current owner; when the window changes hands they stop showing.
import type { RegionId } from '@shared/types'
import { PROFILE_LIMITS } from '@shared/windowProfile'
import type { UserRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest, forbidden, notFound } from '../lib/errors'
import { nowIso, type AppContext } from '../context'
import { audit } from './audit'
import { loadLinks, loadRow, loadWindow, parseWindowRef } from './windows'

const SUSPENDED = 'บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน'

async function ownedRow(ctx: AppContext, user: UserRow, region: RegionId, num: number) {
  if (user.suspended) throw forbidden(SUSPENDED)
  const row = await loadRow(ctx.db, region, num)
  if (!row.owner_id || row.owner_id !== user.id) throw forbidden('คุณไม่ใช่เจ้าของหน้าต่างบานนี้')
  return row
}

const updateText = (value: unknown) => {
  const text = String(value ?? '').trim()
  if (!text) throw badRequest('กรุณาพิมพ์ข้อความ')
  if (text.length > PROFILE_LIMITS.updateText) throw badRequest(`ข้อความยาวได้ไม่เกิน ${PROFILE_LIMITS.updateText} ตัวอักษร`)
  return text
}

// ---------------------------------------------------------------- daily updates

export async function postUpdate(ctx: AppContext, user: UserRow, region: RegionId, num: number, input: { text?: unknown }) {
  await ownedRow(ctx, user, region, num)
  await ctx.db
    .insertInto('window_updates')
    .values({ id: newId('up'), region, num, owner_id: user.id, text: updateText(input.text), created_at: nowIso(), edited_at: null })
    .execute()
  return loadWindow(ctx, region, num, user.id)
}

export async function editUpdate(ctx: AppContext, user: UserRow, region: RegionId, num: number, id: string, input: { text?: unknown }) {
  await ownedRow(ctx, user, region, num)
  const result = await ctx.db
    .updateTable('window_updates')
    .set({ text: updateText(input.text), edited_at: nowIso() })
    .where('id', '=', id)
    .where('region', '=', region)
    .where('num', '=', num)
    .where('owner_id', '=', user.id)
    .executeTakeFirst()
  if (!Number(result.numUpdatedRows)) throw notFound('ไม่พบอัปเดตนี้')
  return loadWindow(ctx, region, num, user.id)
}

export async function deleteUpdate(ctx: AppContext, user: UserRow, region: RegionId, num: number, id: string) {
  await ownedRow(ctx, user, region, num)
  await ctx.db.deleteFrom('window_updates').where('id', '=', id).where('region', '=', region).where('num', '=', num).where('owner_id', '=', user.id).execute()
  return loadWindow(ctx, region, num, user.id)
}

/** Moderation: an admin removes an unsuitable update. */
export async function adminDeleteUpdate(ctx: AppContext, admin: UserRow, id: string) {
  const update = await ctx.db
    .selectFrom('window_updates')
    .innerJoin('windows', (j) => j.onRef('windows.region', '=', 'window_updates.region').onRef('windows.num', '=', 'window_updates.num'))
    .select(['window_updates.region', 'window_updates.num', 'window_updates.text', 'windows.code'])
    .where('window_updates.id', '=', id)
    .executeTakeFirst()
  if (!update) throw notFound('ไม่พบอัปเดตนี้')
  await ctx.db.deleteFrom('window_updates').where('id', '=', id).execute()
  await audit(ctx.db, admin, 'ลบอัปเดตประจำวัน', `${update.code}: ${update.text.slice(0, 80)}`)
  return loadWindow(ctx, update.region as RegionId, update.num, admin.id)
}

// ---------------------------------------------------------------- Friend and Co

/**
 * The owner of another window asks to be shown on this one. One request per pair of windows:
 * asking again replaces the message (and re-opens a rejected request).
 */
export async function requestLink(ctx: AppContext, user: UserRow, region: RegionId, num: number, input: { fromRegion?: unknown; fromNum?: unknown; message?: unknown }) {
  if (user.suspended) throw forbidden(SUSPENDED)
  const from = parseWindowRef(String(input.fromRegion ?? ''), String(input.fromNum ?? ''))
  if (from.region === region && from.num === num) throw badRequest('เลือกบานอื่นที่ไม่ใช่บานนี้')
  const target = await loadRow(ctx.db, region, num)
  if (!target.owner_id) throw badRequest('ขอเชื่อมลิงก์ได้เฉพาะบานที่มีเจ้าของแล้ว')
  const source = await loadRow(ctx.db, from.region, from.num)
  if (source.owner_id !== user.id) throw forbidden('ขอเชื่อมลิงก์ได้เฉพาะบานที่คุณเป็นเจ้าของ')
  const message = String(input.message ?? '').trim().slice(0, PROFILE_LIMITS.linkMessage)

  const existing = await ctx.db
    .selectFrom('window_links')
    .select(['id', 'status'])
    .where('region', '=', region)
    .where('num', '=', num)
    .where('owner_id', '=', target.owner_id)
    .where('from_region', '=', from.region)
    .where('from_num', '=', from.num)
    .where('from_owner_id', '=', user.id)
    .executeTakeFirst()
  if (existing?.status === 'approved') throw badRequest('บานของคุณเชื่อมลิงก์กับบานนี้อยู่แล้ว')
  const now = nowIso()
  if (existing) {
    await ctx.db.updateTable('window_links').set({ message, status: 'pending', created_at: now, decided_at: null }).where('id', '=', existing.id).execute()
  } else {
    await ctx.db
      .insertInto('window_links')
      .values({
        id: newId('wl'),
        region,
        num,
        owner_id: target.owner_id,
        from_region: from.region,
        from_num: from.num,
        from_owner_id: user.id,
        message,
        status: 'pending',
        created_at: now,
        decided_at: null,
      })
      .execute()
  }
  return loadWindow(ctx, region, num, user.id)
}

/** The owner approves (up to PROFILE_LIMITS.links shown at once) or rejects a request. */
export async function decideLink(ctx: AppContext, user: UserRow, region: RegionId, num: number, id: string, approve: boolean) {
  await ownedRow(ctx, user, region, num)
  const { links, linkRequests } = await loadLinks(ctx.db, region, num, user.id, user.id)
  if (!linkRequests?.some((r) => r.id === id)) throw notFound('ไม่พบคำขอนี้ หรือคำขอถูกจัดการไปแล้ว')
  if (approve && links.length >= PROFILE_LIMITS.links) throw badRequest(`ครบ ${PROFILE_LIMITS.links} ช่องแล้ว กรุณายกเลิกลิงก์เดิมก่อน`)
  await ctx.db
    .updateTable('window_links')
    .set({ status: approve ? 'approved' : 'rejected', decided_at: nowIso() })
    .where('id', '=', id)
    .where('status', '=', 'pending')
    .execute()
  return loadWindow(ctx, region, num, user.id)
}

/** Either side can remove a link: the owner of this window, or the owner of the linked one. */
export async function removeLink(ctx: AppContext, user: UserRow, region: RegionId, num: number, id: string) {
  const row = await loadRow(ctx.db, region, num)
  const link = await ctx.db
    .selectFrom('window_links')
    .select(['owner_id', 'from_owner_id'])
    .where('id', '=', id)
    .where('region', '=', region)
    .where('num', '=', num)
    .executeTakeFirst()
  if (!link) throw notFound('ไม่พบลิงก์นี้')
  const isOwner = !!row.owner_id && row.owner_id === user.id && link.owner_id === user.id
  if (!isOwner && link.from_owner_id !== user.id) throw forbidden('คุณไม่มีสิทธิ์ยกเลิกลิงก์นี้')
  await ctx.db.deleteFrom('window_links').where('id', '=', id).execute()
  return loadWindow(ctx, region, num, user.id)
}
