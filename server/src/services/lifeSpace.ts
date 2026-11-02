// Life Space (Vote my life) journal: the page's state as one JSON document per account.
// The page only sends it here after the user consents; withdrawing consent deletes it.
import type { UserRow } from '../db/schema'
import { badRequest } from '../lib/errors'
import { nowIso, type AppContext } from '../context'

/** Room for 12 profiles with years of daily votes and notes. */
export const LIFE_SPACE_MAX_BYTES = 2 * 1024 * 1024

export async function getLifeSpace(ctx: AppContext, user: UserRow) {
  const row = await ctx.db.selectFrom('life_space').select(['data', 'updated_at']).where('user_id', '=', user.id).executeTakeFirst()
  return { data: row?.data ?? null, updatedAt: row?.updated_at ?? null }
}

export async function saveLifeSpace(ctx: AppContext, user: UserRow, data: unknown) {
  if (typeof data !== 'string') throw badRequest('ข้อมูลบันทึกประจำวันไม่ถูกต้อง')
  if (Buffer.byteLength(data) > LIFE_SPACE_MAX_BYTES) throw badRequest('บันทึกประจำวันมีขนาดใหญ่เกินไป')
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    throw badRequest('ข้อมูลบันทึกประจำวันไม่ถูกต้อง')
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { profiles?: unknown }).profiles)) {
    throw badRequest('ข้อมูลบันทึกประจำวันไม่ถูกต้อง')
  }

  const updatedAt = nowIso()
  const update = () => ctx.db.updateTable('life_space').set({ data, updated_at: updatedAt }).where('user_id', '=', user.id).executeTakeFirst()
  if (!Number((await update()).numUpdatedRows)) {
    // Two saves can race on the first insert; the loser just updates the row the other made.
    await ctx.db.insertInto('life_space').values({ user_id: user.id, data, updated_at: updatedAt }).execute().catch(update)
  }
  return { updatedAt }
}

export async function deleteLifeSpace(ctx: AppContext, user: UserRow) {
  await ctx.db.deleteFrom('life_space').where('user_id', '=', user.id).execute()
}
