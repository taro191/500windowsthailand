// Boards and windows: reading, owner actions (edit, list for resale), likes and follows.
// Buying and claiming live in purchases.ts because they involve payments.
import type { CategoryId, ImageUpdate, OwnerHistoryEntry, RegionId, WindowItem } from '@shared/types'
import { REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import { CATEGORY_IDS } from '@shared/categories'
import { createEmptyWindows, DEMO_IMAGES } from '@shared/seedWindows'
import { thaiDayKey } from '@shared/thaiTime'
import { getEditAvailability, getHoldingPeriod, getPriceCap, MIN_RESALE_PRICE } from '@shared/ownershipRules'
import { isPromoSlot } from '@shared/promo'
import type { UserRow, WindowRow } from '../db/schema'
import type { DB } from '../db'
import { newId } from '../lib/crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { isDataUrl, saveImage } from '../lib/files'
import { nowIso, type AppContext } from '../context'
import { getSettings } from './settings'
import { assertCanTrade } from './users'

type Tx = DB

export function parseWindowRef(region: string, num: string | number): { region: RegionId; num: number } {
  const n = Number(num)
  if (!REGION_IDS.includes(region as RegionId)) throw notFound('ไม่พบภูมิภาค')
  const count = REGIONS_BY_ID[region as RegionId].windowCount || 500
  if (!Number.isInteger(n) || n < 1 || n > count) throw notFound('ไม่พบบานหน้าต่าง')
  return { region: region as RegionId, num: n }
}

/** Row values for a brand-new, empty window (used for seeding and when an admin releases one). */
export function emptyWindowRow(region: RegionId, num: number, now = nowIso()): WindowRow {
  const w = createEmptyWindows(region)[num - 1]
  return {
    region,
    num,
    code: w.code,
    status: 'available',
    title: w.title,
    description: w.description,
    image_url: '',
    category: w.category,
    province: w.province,
    claim_price: w.claimPrice,
    resale_price: null,
    owner_id: null,
    owner_contact: null,
    external_link: null,
    claimed_at: null,
    owner_changed_at: null,
    owner_change_kind: null,
    last_purchase_price: null,
    last_image_updated_at: null,
    views_count: 0,
    likes_count: 0,
    likes_day: null,
    likes_day_count: 0,
    followers_base: 0,
    note_day: null,
    note_text: null,
    note_at: null,
    previous_owner_id: null,
    reserved_order_id: null,
    updated_at: now,
  }
}

// ---------------------------------------------------------------- reading

type RowWithOwner = WindowRow & { owner_name: string | null }

interface Extras {
  images?: ImageUpdate[]
  owners?: OwnerHistoryEntry[]
  followerCount?: number
  viewerFollows?: boolean
  viewerId?: string | null
}

/**
 * API shape of a window. Followers are sent as a count (followersBase) plus the viewer's
 * own id when they follow, so other users' ids are never exposed. Owner contact is private.
 */
export function toWindowItem(row: RowWithOwner, extras: Extras = {}): WindowItem {
  const isOwner = !!extras.viewerId && row.owner_id === extras.viewerId
  const followers = extras.followerCount ?? 0
  return {
    id: row.num,
    code: row.code,
    region: row.region as RegionId,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    category: row.category as CategoryId,
    province: row.province,
    status: row.status,
    claimPrice: row.claim_price,
    resalePrice: row.resale_price ?? undefined,
    ownerName: row.owner_id ? row.owner_name || 'ผู้ใช้' : 'ยังไม่มีเจ้าของ',
    ownerId: row.owner_id || '',
    ownerContact: isOwner ? row.owner_contact ?? undefined : undefined,
    externalLink: row.external_link ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
    ownerChangedAt: row.owner_changed_at ?? undefined,
    ownerChangeKind: row.owner_change_kind ?? undefined,
    lastPurchasePrice: row.last_purchase_price ?? undefined,
    lastImageUpdatedAt: row.last_image_updated_at ?? undefined,
    imageUpdateHistory: extras.images ?? [],
    previousOwnerId: row.previous_owner_id ?? undefined,
    previousOwnerHistory: extras.owners,
    viewsCount: row.views_count,
    likesCount: row.likes_count,
    dailyLikes: row.likes_day ? { day: row.likes_day, count: row.likes_day_count } : undefined,
    followersBase: row.followers_base + followers - (extras.viewerFollows ? 1 : 0),
    followerIds: extras.viewerFollows && extras.viewerId ? [extras.viewerId] : [],
    dailyNote: row.note_day && row.note_text ? { day: row.note_day, text: row.note_text, at: row.note_at || '' } : undefined,
    slotPosition: row.num,
    reserved: row.reserved_order_id ? true : undefined,
  }
}

const withOwnerName = (db: DB) =>
  db.selectFrom('windows').leftJoin('users', 'users.id', 'windows.owner_id').selectAll('windows').select('users.name as owner_name')

/**
 * Every window that differs from its empty default, on all boards. The client fills in the
 * untouched windows itself (createEmptyWindows), which keeps the response small.
 * Image history is limited to the latest entry here; the detail endpoint returns all of it.
 */
export async function loadBoards(ctx: AppContext, viewerId: string | null): Promise<WindowItem[]> {
  const rows = await withOwnerName(ctx.db)
    .where((eb) =>
      eb.or([
        eb('windows.owner_id', 'is not', null),
        eb('windows.previous_owner_id', 'is not', null),
        eb('windows.reserved_order_id', 'is not', null),
        eb('windows.likes_count', '>', 0),
        eb('windows.views_count', '>', 0),
      ]),
    )
    .execute()

  const latestImages = await ctx.db
    .selectFrom('window_images')
    .select(['region', 'num', 'date', 'image_url', 'caption'])
    .orderBy('date', 'desc')
    .execute()
  const imageByWindow = new Map<string, ImageUpdate>()
  for (const image of latestImages) {
    const key = `${image.region}:${image.num}`
    if (!imageByWindow.has(key)) imageByWindow.set(key, { date: image.date, imageUrl: image.image_url, caption: image.caption })
  }

  const follows = await ctx.db
    .selectFrom('window_follows')
    .select(['region', 'num', 'user_id'])
    .execute()
  const followCount = new Map<string, number>()
  const mine = new Set<string>()
  for (const f of follows) {
    const key = `${f.region}:${f.num}`
    followCount.set(key, (followCount.get(key) || 0) + 1)
    if (viewerId && f.user_id === viewerId) mine.add(key)
  }

  return rows.map((row) => {
    const key = `${row.region}:${row.num}`
    const image = imageByWindow.get(key)
    return toWindowItem(row, {
      images: image ? [image] : [],
      followerCount: followCount.get(key) || 0,
      viewerFollows: mine.has(key),
      viewerId,
    })
  })
}

async function loadRow(db: DB, region: RegionId, num: number) {
  const row = await withOwnerName(db).where('windows.region', '=', region).where('windows.num', '=', num).executeTakeFirst()
  if (!row) throw notFound('ไม่พบบานหน้าต่าง')
  return row
}

/** One window with its full image and owner history. */
export async function loadWindow(ctx: AppContext, region: RegionId, num: number, viewerId: string | null, db: DB = ctx.db) {
  const row = await loadRow(db, region, num)
  const [images, owners, follows] = await Promise.all([
    db.selectFrom('window_images').selectAll().where('region', '=', region).where('num', '=', num).orderBy('date', 'desc').execute(),
    db.selectFrom('window_owners').selectAll().where('region', '=', region).where('num', '=', num).orderBy('transferred_at', 'asc').execute(),
    db.selectFrom('window_follows').select('user_id').where('region', '=', region).where('num', '=', num).execute(),
  ])
  return toWindowItem(row, {
    images: images.map((i) => ({ date: i.date, imageUrl: i.image_url, caption: i.caption })),
    owners: owners
      .filter((o) => o.type !== 'released')
      .map((o) => ({ ownerId: o.owner_id, transferredAt: o.transferred_at, type: o.type === 'transfer' ? 'transfer' : 'resale' })),
    followerCount: follows.length,
    viewerFollows: !!viewerId && follows.some((f) => f.user_id === viewerId),
    viewerId,
  })
}

export async function recordView(ctx: AppContext, region: RegionId, num: number) {
  await ctx.db
    .updateTable('windows')
    .set((eb) => ({ views_count: eb('views_count', '+', 1) }))
    .where('region', '=', region)
    .where('num', '=', num)
    .execute()
}

// ---------------------------------------------------------------- content

export interface WindowContentInput {
  title: string
  description: string
  imageUrl?: string
  category: string
  province: string
  ownerContact?: string
  externalLink?: string
  caption?: string
  dailyNote?: string
}

const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

/** A new image must be an upload (data URL) or one of the sample images. */
export async function resolveImage(ctx: AppContext, imageUrl: string): Promise<string> {
  if (isDataUrl(imageUrl)) return saveImage(ctx.config.uploadDir, imageUrl, 'windows')
  if (DEMO_IMAGES.includes(imageUrl)) return imageUrl
  throw badRequest('กรุณาอัปโหลดรูปภาพใหม่')
}

export function cleanContent(input: WindowContentInput, region: RegionId) {
  const link = clean(input.externalLink, 500)
  if (link && !/^https?:\/\//i.test(link)) throw badRequest('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://')
  const category = CATEGORY_IDS.includes(input.category as CategoryId) ? input.category : CATEGORY_IDS[0]
  const provinces = REGIONS_BY_ID[region].provinces
  return {
    title: clean(input.title, 120),
    description: clean(input.description, 1000),
    category,
    province: provinces.includes(input.province) ? input.province : clean(input.province, 64) || provinces[0],
    owner_contact: clean(input.ownerContact, 200) || null,
    external_link: link || null,
    caption: clean(input.caption, 200),
    dailyNote: clean(input.dailyNote, 80),
  }
}

export async function insertImage(db: Tx, region: RegionId, num: number, imageUrl: string, caption: string, date: string) {
  await db.insertInto('window_images').values({ id: newId('wi'), region, num, date, image_url: imageUrl, caption }).execute()
}

/** Owner edit (once per 24 hours). A new image is added to the image history. */
export async function editWindow(ctx: AppContext, user: UserRow, region: RegionId, num: number, input: WindowContentInput) {
  if (user.suspended) throw forbidden('บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน')
  const row = await loadRow(ctx.db, region, num)
  if (row.owner_id !== user.id) throw forbidden('คุณไม่ใช่เจ้าของหน้าต่างบานนี้')
  const edit = getEditAvailability(toWindowItem(row))
  if (!edit.canUpdate) {
    throw badRequest(`แก้ไขได้วันละ 1 ครั้งเท่านั้น (แก้ไขครั้งถัดไปได้ในอีก ${edit.hoursRemaining} ชม. ${edit.minutesRemaining} นาที)`)
  }
  const content = cleanContent(input, region)
  if (!content.title) throw badRequest('กรุณาระบุชื่อหน้าต่าง')

  const now = nowIso()
  const imageChanged = !!input.imageUrl && input.imageUrl !== row.image_url
  const imageUrl = imageChanged ? await resolveImage(ctx, input.imageUrl!) : row.image_url
  await ctx.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('windows')
      .set({
        title: content.title,
        description: content.description || row.description,
        category: content.category,
        province: content.province,
        owner_contact: content.owner_contact,
        external_link: content.external_link,
        image_url: imageUrl,
        last_image_updated_at: now,
        ...(content.dailyNote ? { note_day: thaiDayKey(), note_text: content.dailyNote, note_at: now } : {}),
        updated_at: now,
      })
      .where('region', '=', region)
      .where('num', '=', num)
      .where('owner_id', '=', user.id)
      .execute()
    if (imageChanged) await insertImage(trx, region, num, imageUrl, content.caption || 'อัปเดตรูปภาพ', now)
  })
  return loadWindow(ctx, region, num, user.id)
}

// ---------------------------------------------------------------- resale listing

/** List an owned window for resale (after 30 days, at 100 ฿ up to the price cap). */
export async function listForResale(ctx: AppContext, user: UserRow, region: RegionId, num: number, price: number) {
  assertCanTrade(user)
  const row = await loadRow(ctx.db, region, num)
  if (row.owner_id !== user.id) throw forbidden('คุณไม่ใช่เจ้าของหน้าต่างบานนี้')
  if (row.reserved_order_id) throw conflict('บานนี้มีผู้ซื้อรอตรวจสอบการชำระเงินอยู่ เปลี่ยนราคาไม่ได้ชั่วคราว')

  const window = await loadWindow(ctx, region, num, user.id)
  const holding = getHoldingPeriod(window)
  if (!holding.isEligible) {
    throw badRequest(
      `ตามเงื่อนไขข้อ 1: เจ้าของจะต้องถือครองหน้าต่างบานนี้ไม่ต่ำกว่า 1 เดือนขึ้นไป (30 วัน) จึงจะสามารถเปิดขายต่อได้ (ปัจจุบันถือครองมาแล้ว ${holding.daysHeld} วัน, ขาดอีก ${holding.daysRemaining} วัน)`,
    )
  }
  if (!Number.isInteger(price) || price < MIN_RESALE_PRICE) throw badRequest(`ราคาขายต่อต้องเป็นจำนวนเต็มและไม่ต่ำกว่า ${MIN_RESALE_PRICE} ฿`)
  const cap = getPriceCap(window, await getSettings(ctx))
  if (cap.maxAllowedPrice !== null && price > cap.maxAllowedPrice) {
    throw badRequest(`ไม่สามารถตั้งราคาเกิน ${cap.maxAllowedPrice.toLocaleString()} ฿ ได้ (${cap.ruleDescription})`)
  }
  await ctx.db
    .updateTable('windows')
    .set({ status: 'for_resale', resale_price: price, updated_at: nowIso() })
    .where('region', '=', region)
    .where('num', '=', num)
    .where('owner_id', '=', user.id)
    .where('reserved_order_id', 'is', null)
    .execute()
  return loadWindow(ctx, region, num, user.id)
}

export async function cancelResale(ctx: AppContext, user: UserRow, region: RegionId, num: number) {
  const row = await loadRow(ctx.db, region, num)
  if (row.owner_id !== user.id) throw forbidden('คุณไม่ใช่เจ้าของหน้าต่างบานนี้')
  if (row.reserved_order_id) throw conflict('บานนี้มีผู้ซื้อรอตรวจสอบการชำระเงินอยู่ ยกเลิกการขายไม่ได้ชั่วคราว')
  await ctx.db
    .updateTable('windows')
    .set({ status: 'occupied', resale_price: null, updated_at: nowIso() })
    .where('region', '=', region)
    .where('num', '=', num)
    .where('owner_id', '=', user.id)
    .where('reserved_order_id', 'is', null)
    .execute()
  return loadWindow(ctx, region, num, user.id)
}

// ---------------------------------------------------------------- likes & follows

/** One like per visitor per window per Thai day. Returns whether it counted. */
export async function likeWindow(ctx: AppContext, region: RegionId, num: number, visitorId: string) {
  const row = await loadRow(ctx.db, region, num)
  if (row.status === 'available' || isPromoSlot(num)) throw badRequest('กดถูกใจได้เฉพาะบานที่มีเจ้าของแล้ว')
  const day = thaiDayKey()
  const counted = await ctx.db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('window_likes')
      .select('day')
      .where('region', '=', region)
      .where('num', '=', num)
      .where('day', '=', day)
      .where('visitor_id', '=', visitorId)
      .executeTakeFirst()
    if (existing) return false
    await trx.insertInto('window_likes').values({ region, num, day, visitor_id: visitorId }).execute()
    await trx
      .updateTable('windows')
      .set((eb) => ({
        likes_count: eb('likes_count', '+', 1),
        likes_day_count: eb.case().when('likes_day', '=', day).then(eb('likes_day_count', '+', 1)).else(1).end(),
        likes_day: day,
      }))
      .where('region', '=', region)
      .where('num', '=', num)
      .execute()
    return true
  })
  return { counted }
}

export async function toggleFollow(ctx: AppContext, user: UserRow, region: RegionId, num: number) {
  await loadRow(ctx.db, region, num)
  const where = { region, num, user_id: user.id }
  const existing = await ctx.db
    .selectFrom('window_follows')
    .select('user_id')
    .where('region', '=', region)
    .where('num', '=', num)
    .where('user_id', '=', user.id)
    .executeTakeFirst()
  if (existing) {
    await ctx.db.deleteFrom('window_follows').where('region', '=', region).where('num', '=', num).where('user_id', '=', user.id).execute()
  } else {
    await ctx.db.insertInto('window_follows').values({ ...where, created_at: nowIso() }).execute()
  }
  return { following: !existing }
}

// ---------------------------------------------------------------- demo helpers (DEMO_TOOLS=true)

export async function demoSkipEditCooldown(ctx: AppContext, user: UserRow, region: RegionId, num: number) {
  const at = new Date(Date.now() - 86_400_000 - 60_000).toISOString()
  await ctx.db.updateTable('windows').set({ last_image_updated_at: at }).where('region', '=', region).where('num', '=', num).where('owner_id', '=', user.id).execute()
  return loadWindow(ctx, region, num, user.id)
}

export async function demoBackdateOwnership(ctx: AppContext, user: UserRow, region: RegionId, num: number, days: number) {
  const at = new Date(Date.now() - Math.min(Math.max(days, 0), 3650) * 86_400_000).toISOString()
  await ctx.db
    .updateTable('windows')
    .set({ claimed_at: at, owner_changed_at: at })
    .where('region', '=', region)
    .where('num', '=', num)
    .where('owner_id', '=', user.id)
    .execute()
  return loadWindow(ctx, region, num, user.id)
}
