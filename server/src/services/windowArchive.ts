// Super admin: remove a window's content into an archive (the window goes back to the pool,
// claimable as usual) and later put that content back on another empty window.
import type { RegionId, WindowArchive } from '@shared/types'
import { isPromoSlot } from '@shared/promo'
import { REGIONS_BY_ID } from '@shared/regions'
import type { UserRow, WindowArchivesTable, WindowRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { nowIso, type AppContext } from '../context'
import { audit } from './audit'
import { notifyAdminAction } from './notify'
import { getSettings } from './settings'
import { isSuperAdmin } from './users'
import { emptyWindowRow, insertImage, loadWindow } from './windows'

/** Window columns kept in the archive and written back on restore. */
type ArchivedFields = Omit<WindowRow, 'region' | 'num' | 'code' | 'status' | 'claim_price' | 'resale_price' | 'reserved_order_id' | 'suspended_at' | 'updated_at'>

function assertSuperAdmin(ctx: AppContext, admin: UserRow) {
  if (!isSuperAdmin(ctx, admin)) throw forbidden('เฉพาะ Super Admin เท่านั้น')
}

const requireReason = (input: unknown) => {
  const reason = String(input ?? '').trim().slice(0, 500)
  if (!reason) throw badRequest('กรุณาระบุเหตุผล')
  return reason
}

function toArchive(row: WindowArchivesTable): WindowArchive {
  const data = JSON.parse(row.data) as Partial<ArchivedFields>
  return {
    id: row.id,
    region: row.region as RegionId,
    num: row.num,
    code: row.code,
    ownerId: row.owner_id ?? undefined,
    ownerName: row.owner_name,
    title: row.title,
    imageUrl: data.image_url ?? '',
    reason: row.reason,
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
    restoredAt: row.restored_at ?? undefined,
    restoredTo: row.restored_to ?? undefined,
    restoredBy: row.restored_by ?? undefined,
  }
}

export async function listArchives(ctx: AppContext, admin: UserRow): Promise<WindowArchive[]> {
  assertSuperAdmin(ctx, admin)
  const rows = await ctx.db.selectFrom('window_archives').selectAll().orderBy('archived_at', 'desc').execute()
  return rows.map(toArchive)
}

/** Moves the window's content and owner into the archive and empties the window. */
export async function archiveWindow(ctx: AppContext, admin: UserRow, region: RegionId, num: number, reasonInput: string) {
  assertSuperAdmin(ctx, admin)
  const reason = requireReason(reasonInput)
  const row = await ctx.db.selectFrom('windows').selectAll().where('region', '=', region).where('num', '=', num).executeTakeFirst()
  if (!row) throw notFound('ไม่พบบานหน้าต่าง')
  if (!row.owner_id) throw badRequest('บานนี้ว่างอยู่แล้ว ไม่มีข้อมูลให้ลบ')
  if (row.reserved_order_id) throw badRequest('บานนี้มีรายการชำระเงินรอตรวจสอบ กรุณาพิจารณาสลิปก่อน')
  const owner = await ctx.db.selectFrom('users').select('name').where('id', '=', row.owner_id).executeTakeFirst()

  const { region: _r, num: _n, code: _c, status: _s, claim_price: _p, resale_price: _rp, reserved_order_id: _o, suspended_at: _su, updated_at: _u, ...kept } = row
  const now = nowIso()
  const archiveId = newId('wa')
  const { claimPrice } = (await getSettings(ctx)).rules
  await ctx.db.transaction().execute(async (trx) => {
    await trx
      .insertInto('window_archives')
      .values({
        id: archiveId,
        region,
        num,
        code: row.code,
        owner_id: row.owner_id,
        owner_name: owner?.name ?? '-',
        title: row.title.slice(0, 255),
        data: JSON.stringify(kept satisfies ArchivedFields),
        reason,
        archived_at: now,
        archived_by: admin.name,
        restored_at: null,
        restored_to: null,
        restored_by: null,
      })
      .execute()
    const { region: _er, num: _en, ...empty } = emptyWindowRow(region, num, now, claimPrice)
    await trx.updateTable('windows').set({ ...empty, previous_owner_id: row.owner_id }).where('region', '=', region).where('num', '=', num).execute()
    await trx.insertInto('window_owners').values({ id: newId('wo'), region, num, owner_id: row.owner_id!, transferred_at: now, type: 'released' }).execute()
    await trx.deleteFrom('window_follows').where('region', '=', region).where('num', '=', num).execute()
    await audit(trx, admin, 'ลบบานและเก็บข้อมูลไว้', `${row.code} (เจ้าของ ${owner?.name ?? '-'}) · ${reason}`)
  })
  notifyAdminAction(ctx, 'security.windowArchive', admin, 'ลบบานและเก็บข้อมูลไว้', `บาน: ${row.code} «${row.title}»\nเจ้าของ: ${owner?.name ?? '-'}\nเหตุผล: ${reason}\nบานนี้ว่างแล้ว เปิดให้จับจองได้ตามปกติ`)
  return { window: await loadWindow(ctx, region, num, null), archives: await listArchives(ctx, admin) }
}

/** Puts an archived window's content and owner on an empty window. */
export async function restoreArchive(ctx: AppContext, admin: UserRow, archiveId: string, region: RegionId, num: number) {
  assertSuperAdmin(ctx, admin)
  const archive = await ctx.db.selectFrom('window_archives').selectAll().where('id', '=', archiveId).executeTakeFirst()
  if (!archive) throw notFound('ไม่พบข้อมูลบานที่เก็บไว้')
  if (archive.restored_at) throw conflict(`ข้อมูลนี้ถูกนำกลับไปลงบาน ${archive.restored_to} แล้ว`)
  if (isPromoSlot(num)) throw badRequest('หน้าต่างหมายเลข 481–486 ล็อกไว้เป็นพื้นที่โปรโมทของระบบ')
  const target = await ctx.db.selectFrom('windows').selectAll().where('region', '=', region).where('num', '=', num).executeTakeFirst()
  if (!target) throw notFound('ไม่พบบานหน้าต่าง')
  if (target.status !== 'available' || target.owner_id || target.reserved_order_id) throw conflict(`บาน ${target.code} ไม่ว่าง กรุณาเลือกบานว่าง`)
  const owner = archive.owner_id ? await ctx.db.selectFrom('users').select(['id', 'name']).where('id', '=', archive.owner_id).executeTakeFirst() : undefined
  if (!owner) throw badRequest('ไม่พบบัญชีเจ้าของเดิมแล้ว นำข้อมูลกลับไม่ได้')

  const data = JSON.parse(archive.data) as ArchivedFields
  const now = nowIso()
  await ctx.db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('windows')
      .set({ ...data, owner_id: owner.id, status: 'occupied', resale_price: null, reserved_order_id: null, suspended_at: null, owner_changed_at: now, updated_at: now })
      .where('region', '=', region)
      .where('num', '=', num)
      .where('status', '=', 'available')
      .where('owner_id', 'is', null)
      .where('reserved_order_id', 'is', null)
      .executeTakeFirst()
    if (Number(updated.numUpdatedRows) === 0) throw conflict(`บาน ${target.code} ไม่ว่าง กรุณาเลือกบานว่าง`)
    if (data.image_url) await insertImage(trx, region, num, data.image_url, `ย้ายข้อมูลมาจากบาน ${archive.code}`, now)
    const marked = await trx
      .updateTable('window_archives')
      .set({ restored_at: now, restored_to: target.code, restored_by: admin.name })
      .where('id', '=', archiveId)
      .where('restored_at', 'is', null)
      .executeTakeFirst()
    if (Number(marked.numUpdatedRows) === 0) throw conflict('ข้อมูลนี้ถูกนำกลับไปแล้ว')
    await audit(trx, admin, 'นำข้อมูลบานกลับมาลง', `${archive.code} → ${target.code} (เจ้าของ ${owner.name})`)
  })
  const where = REGIONS_BY_ID[region]?.name ?? region
  notifyAdminAction(ctx, 'security.windowArchive', admin, 'นำข้อมูลบานกลับมาลง', `จาก: ${archive.code} «${archive.title}»\nไปที่: ${target.code} (${where})\nเจ้าของ: ${owner.name}`)
  return { window: await loadWindow(ctx, region, num, null), archives: await listArchives(ctx, admin) }
}
