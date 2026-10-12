// The owner's public page for a window (logo, gallery, offerings, contacts, details) and
// visitors' reviews. Profile edits are free and don't count toward the daily content edits.
import type { RegionId, WindowProfile } from '@shared/types'
import { cleanProfile, PROFILE_LIMITS, profileImages } from '@shared/windowProfile'
import type { UserRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest, forbidden, notFound } from '../lib/errors'
import { deleteUpload, isDataUrl, saveImage } from '../lib/files'
import { nowIso, type AppContext } from '../context'
import { audit } from './audit'
import { loadRow, loadWindow, parseProfile } from './windows'

export async function updateWindowProfile(ctx: AppContext, user: UserRow, region: RegionId, num: number, input: Partial<WindowProfile>) {
  if (user.suspended) throw forbidden('บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน')
  const row = await loadRow(ctx.db, region, num)
  if (row.owner_id !== user.id) throw forbidden('คุณไม่ใช่เจ้าของหน้าต่างบานนี้')
  const { profile, error } = cleanProfile(input)
  if (error) throw badRequest(error)

  // Images are new uploads, or ones this profile already has (nothing from elsewhere).
  const before = profileImages(parseProfile(row.profile_json))
  const resolve = async (url: string) => {
    if (!url) return ''
    if (isDataUrl(url)) return saveImage(ctx.config.uploadDir, url, 'windows')
    if (before.includes(url)) return url
    throw badRequest('กรุณาอัปโหลดรูปภาพใหม่')
  }
  profile.logoUrl = await resolve(profile.logoUrl)
  profile.gallery = (await Promise.all(profile.gallery.map(resolve))).filter(Boolean)
  for (const offering of profile.offerings) offering.imageUrl = await resolve(offering.imageUrl)

  await ctx.db
    .updateTable('windows')
    .set({ profile_json: JSON.stringify(profile), updated_at: nowIso() })
    .where('region', '=', region)
    .where('num', '=', num)
    .where('owner_id', '=', user.id)
    .execute()
  const kept = new Set(profileImages(profile))
  for (const image of before) if (!kept.has(image)) await deleteUpload(ctx.config.uploadDir, image)
  return loadWindow(ctx, region, num, user.id)
}

// ---------------------------------------------------------------- reviews

/** One review per user for the current owner; writing again replaces it. Owners can't review their own window. */
export async function saveReview(ctx: AppContext, user: UserRow, region: RegionId, num: number, input: { rating?: unknown; text?: unknown }) {
  if (user.suspended) throw forbidden('บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน')
  const row = await loadRow(ctx.db, region, num)
  if (!row.owner_id) throw badRequest('รีวิวได้เฉพาะบานที่มีเจ้าของแล้ว')
  if (row.owner_id === user.id) throw forbidden('รีวิวบานของตัวเองไม่ได้')
  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw badRequest('กรุณาให้คะแนน 1–5 ดาว')
  const text = String(input.text ?? '').trim().slice(0, PROFILE_LIMITS.reviewText)

  const now = nowIso()
  const existing = await ctx.db
    .selectFrom('window_reviews')
    .select('id')
    .where('region', '=', region)
    .where('num', '=', num)
    .where('owner_id', '=', row.owner_id)
    .where('user_id', '=', user.id)
    .executeTakeFirst()
  if (existing) {
    await ctx.db.updateTable('window_reviews').set({ rating, text, updated_at: now }).where('id', '=', existing.id).execute()
  } else {
    await ctx.db
      .insertInto('window_reviews')
      .values({ id: newId('rv'), region, num, owner_id: row.owner_id, user_id: user.id, rating, text, created_at: now, updated_at: now })
      .execute()
  }
  return loadWindow(ctx, region, num, user.id)
}

export async function deleteOwnReview(ctx: AppContext, user: UserRow, region: RegionId, num: number) {
  const row = await loadRow(ctx.db, region, num)
  if (row.owner_id) {
    await ctx.db
      .deleteFrom('window_reviews')
      .where('region', '=', region)
      .where('num', '=', num)
      .where('owner_id', '=', row.owner_id)
      .where('user_id', '=', user.id)
      .execute()
  }
  return loadWindow(ctx, region, num, user.id)
}

/** Moderation: an admin removes an unsuitable review. */
export async function adminDeleteReview(ctx: AppContext, admin: UserRow, id: string) {
  const review = await ctx.db
    .selectFrom('window_reviews')
    .innerJoin('windows', (j) => j.onRef('windows.region', '=', 'window_reviews.region').onRef('windows.num', '=', 'window_reviews.num'))
    .leftJoin('users', 'users.id', 'window_reviews.user_id')
    .select(['window_reviews.region', 'window_reviews.num', 'window_reviews.text', 'windows.code', 'users.name'])
    .where('window_reviews.id', '=', id)
    .executeTakeFirst()
  if (!review) throw notFound('ไม่พบรีวิว')
  await ctx.db.deleteFrom('window_reviews').where('id', '=', id).execute()
  await audit(ctx.db, admin, 'ลบรีวิว', `${review.code} · ${review.name ?? '-'}: ${review.text.slice(0, 80) || '(ไม่มีข้อความ)'}`)
  return loadWindow(ctx, review.region as RegionId, review.num, admin.id)
}
