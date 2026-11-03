// The central page (public/kap/central.html): Kapsulep & Co apps, "500WinTH & Co" announcements
// and the signed-in user's own windows. Announcements are written and published by admins.
import type { CentralNews, RegionId } from '@shared/types'
import { thaiDayKey } from '@shared/thaiTime'
import { REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import { daysLeft, REFUND_DAYS, TRIAL_DAYS, TRIAL_GRACE_DAYS, trialPayBy, trialPhase } from '@shared/trial'
import type { CentralNewsTable, UserRow, WindowRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { ApiError, badRequest, conflict, notFound } from '../lib/errors'
import { isDataUrl, saveImage } from '../lib/files'
import { nowIso, type AppContext } from '../context'
import { audit } from './audit'
import { getSettings } from './settings'

/** At most this many announcements are shown at the same time. */
export const NEWS_MAX = 4
const NEWS_TYPES: CentralNews['type'][] = ['system', 'partner', 'product', 'news']

function toNews(row: CentralNewsTable, admin = false): CentralNews {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    by: row.by_name,
    url: row.url,
    img: row.img,
    pin: !!row.pin,
    status: row.status,
    publishAt: row.publish_at,
    endAt: row.end_at ?? undefined,
    ...(admin ? { createdBy: row.created_by, publishedBy: row.published_by ?? undefined, updatedAt: row.updated_at } : {}),
  }
}

/** Public data of the page: published apps and the announcements not ended yet. */
export async function centralData(ctx: AppContext) {
  const { coStore } = await getSettings(ctx)
  const now = nowIso()
  const rows = await ctx.db
    .selectFrom('central_news')
    .selectAll()
    .where('status', '=', 'published')
    .where((eb) => eb.or([eb('end_at', 'is', null), eb('end_at', '>', now)]))
    .execute()
  return {
    serverTime: now,
    apps: coStore.apps.map((a) => ({ id: a.id, status: 'published', n: a.name, d: a.description, u: a.url, c: a.category, b: a.badge, ic: a.iconUrl, i: a.icon })),
    news: rows.map((r) => toNews(r)),
  }
}

type OwnRow = Pick<WindowRow, 'region' | 'num' | 'code' | 'title' | 'image_url' | 'category' | 'views_count' | 'likes_count' | 'likes_day' | 'likes_day_count' | 'followers_base' | 'trial_ends_at' | 'suspended_at'>

function planOf(row: OwnRow) {
  if (row.suspended_at) return { type: row.trial_ends_at ? 'trial' : 'paid', status: 'suspended' }
  if (!row.trial_ends_at) return { type: 'paid', status: 'active' }
  return trialPhase(row.trial_ends_at) === 'trial'
    ? { type: 'trial', status: 'active', daysLeft: daysLeft(row.trial_ends_at) }
    : { type: 'trial', status: 'expiring', daysLeft: daysLeft(trialPayBy(row.trial_ends_at)) }
}

/** "หน้าต่างของฉัน": the user's windows with plan and numbers; null when signed out. */
export async function myCentral(ctx: AppContext, user: UserRow | null) {
  if (!user) return null
  const rows: OwnRow[] = await ctx.db
    .selectFrom('windows')
    .select(['region', 'num', 'code', 'title', 'image_url', 'category', 'views_count', 'likes_count', 'likes_day', 'likes_day_count', 'followers_base', 'trial_ends_at', 'suspended_at'])
    .where('owner_id', '=', user.id)
    .orderBy('region')
    .execute()
  const follows = rows.length
    ? await ctx.db.selectFrom('window_follows').select(['region', 'num']).where('region', 'in', rows.map((r) => r.region)).where('num', 'in', rows.map((r) => r.num)).execute()
    : []
  const today = thaiDayKey()
  const windows = rows.map((r) => {
    const url = `/w/${r.region}/${r.num}`
    return {
      id: r.code,
      name: r.title,
      logo: r.image_url,
      tag: '',
      group: r.region === 'thailand' ? 'central' : 'region',
      groupName: REGIONS_BY_ID[r.region as keyof typeof REGIONS_BY_ID]?.name ?? r.region,
      rank: r.num,
      url,
      // Editing and paying are done on the window page itself; upgrade.html compares the plans first.
      editUrl: url,
      upgradeUrl: `/kap/upgrade.html?w=${r.region}-${r.num}`,
      plan: planOf(r),
      stats: {
        views: r.views_count,
        likes: r.likes_count,
        today: r.likes_day === today ? r.likes_day_count : 0,
        followers: r.followers_base + follows.filter((f) => f.region === r.region && f.num === r.num).length,
      },
    }
  })
  const has = (central: boolean) => rows.some((r) => (r.region === 'thailand') === central)
  return {
    user: { name: user.name },
    windows,
    create: {
      ...(has(true) ? {} : { central: { url: '/' } }),
      ...(has(false) ? {} : { region: { url: '/' } }),
    },
  }
}

// ---------------------------------------------------------------- upgrade page

/** Plan comparison page (public/kap/upgrade.html) for one of the user's windows, `ref` = "<region>-<num>". */
export async function upgradeData(ctx: AppContext, user: UserRow | null, ref: string) {
  if (!user) throw new ApiError(401, 'กรุณาเข้าสู่ระบบก่อน')
  const [, region, num] = ref.match(/^([a-z]+)-(\d+)$/) ?? []
  const row =
    region && REGION_IDS.includes(region as RegionId)
      ? await ctx.db
          .selectFrom('windows')
          .select(['region', 'num', 'code', 'title', 'owner_id', 'claim_price', 'trial_ends_at', 'suspended_at'])
          .where('region', '=', region)
          .where('num', '=', Number(num))
          .executeTakeFirst()
      : undefined
  if (!row || row.owner_id !== user.id) throw notFound('ไม่พบหน้าต่างนี้ในบัญชีของคุณ')
  const { rules } = await getSettings(ctx)
  const url = `/w/${row.region}/${row.num}`
  const phase = row.trial_ends_at ? trialPhase(row.trial_ends_at) : null
  return {
    windowName: row.title || row.code,
    // Paying is done from the window itself (wallet, card or transfer slip).
    payUrl: url,
    backUrl: '/kap/central.html',
    plan: {
      type: row.trial_ends_at ? 'trial' : 'paid',
      status: row.suspended_at ? 'suspended' : phase === 'unpaid' || phase === 'expired' ? 'expired' : 'active',
      daysLeft: row.trial_ends_at ? daysLeft(phase === 'trial' ? row.trial_ends_at : trialPayBy(row.trial_ends_at)) : undefined,
      price: `${(row.trial_ends_at ? row.claim_price : rules.claimPrice).toLocaleString('en-US')} บาท`,
    },
    rules: { trialDays: TRIAL_DAYS, graceDays: TRIAL_GRACE_DAYS, refundDays: REFUND_DAYS, holdDays: rules.minHoldingDays },
  }
}

// ---------------------------------------------------------------- admin

export async function listNews(ctx: AppContext): Promise<CentralNews[]> {
  const rows = await ctx.db.selectFrom('central_news').selectAll().orderBy('publish_at', 'desc').execute()
  return rows.map((r) => toNews(r, true))
}

export interface NewsInput {
  type?: unknown
  title?: unknown
  body?: unknown
  by?: unknown
  url?: unknown
  img?: unknown
  pin?: unknown
  publishAt?: unknown
  endAt?: unknown
}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

async function cleanNews(ctx: AppContext, input: NewsInput) {
  const type = NEWS_TYPES.find((t) => t === input.type)
  if (!type) throw badRequest('กรุณาเลือกประเภท')
  const title = text(input.title, 120)
  if (!title) throw badRequest('กรุณาใส่หัวข้อ')
  const url = text(input.url, 500)
  if (url && !/^https:\/\/\S+$/.test(url) && !/^\/(?!\/)\S*$/.test(url)) throw badRequest('ลิงก์ต้องขึ้นต้นด้วย https:// หรือ / (หน้าในเว็บนี้)')
  const publishAt = Date.parse(String(input.publishAt ?? ''))
  if (Number.isNaN(publishAt)) throw badRequest('กรุณาเลือกเวลาเริ่มเผยแพร่')
  const endRaw = String(input.endAt ?? '').trim()
  const endAt = endRaw ? Date.parse(endRaw) : null
  if (endAt !== null && (Number.isNaN(endAt) || endAt <= publishAt)) throw badRequest('เวลาสิ้นสุดต้องหลังเวลาเริ่มเผยแพร่')
  let img = text(input.img, 3_000_000)
  if (isDataUrl(img)) img = await saveImage(ctx.config.uploadDir, img, 'promo')
  else if (img && !/^\/uploads\/[\w./-]+$/.test(img)) throw badRequest('กรุณาอัปโหลดรูปใหม่')
  return {
    type,
    title,
    body: text(input.body, 400),
    by_name: text(input.by, 60) || '500 Windows Thailand',
    url,
    img,
    pin: input.pin ? 1 : 0,
    publish_at: new Date(publishAt).toISOString(),
    end_at: endAt === null ? null : new Date(endAt).toISOString(),
  }
}

/** Creates or edits an announcement; it is saved as a draft (an edit needs publishing again). */
export async function saveNews(ctx: AppContext, admin: UserRow, id: string | null, input: NewsInput) {
  const values = await cleanNews(ctx, input)
  const now = nowIso()
  if (id) {
    const updated = await ctx.db.updateTable('central_news').set({ ...values, status: 'draft', published_by: null, updated_at: now }).where('id', '=', id).executeTakeFirst()
    if (Number(updated.numUpdatedRows) === 0) throw notFound('ไม่พบประกาศนี้')
  } else {
    id = newId('cn')
    await ctx.db.insertInto('central_news').values({ id, ...values, status: 'draft', created_at: now, created_by: admin.name, updated_at: now, published_by: null }).execute()
  }
  await audit(ctx.db, admin, 'บันทึกร่างประกาศ 500WinTH & Co', values.title)
  return listNews(ctx)
}

/** Most announcements showing at the same moment (each shows from start until end). */
function maxShownAtOnce(items: { start: number; end: number }[]) {
  let max = 0
  for (const a of items) max = Math.max(max, items.filter((b) => b.start <= a.start && a.start < b.end).length)
  return max
}

export async function setNewsPublished(ctx: AppContext, admin: UserRow, id: string, publish: boolean) {
  const row = await ctx.db.selectFrom('central_news').selectAll().where('id', '=', id).executeTakeFirst()
  if (!row) throw notFound('ไม่พบประกาศนี้')
  if (publish) {
    if (row.status === 'published') throw badRequest('ประกาศนี้เผยแพร่อยู่แล้ว')
    const published = await ctx.db.selectFrom('central_news').select(['publish_at', 'end_at']).where('status', '=', 'published').execute()
    const span = (r: { publish_at: string; end_at: string | null }) => ({ start: Date.parse(r.publish_at), end: r.end_at ? Date.parse(r.end_at) : Infinity })
    const mine = span(row)
    const overlapping = published.map(span).filter((s) => s.start < mine.end && mine.start < s.end)
    if (maxShownAtOnce([...overlapping, mine]) > NEWS_MAX) {
      throw conflict(`ช่วงเวลานี้มีประกาศเผยแพร่ครบ ${NEWS_MAX} รายการแล้ว กรุณาเลื่อนเวลา หรือหยุดเผยแพร่ประกาศอื่นก่อน`)
    }
  }
  await ctx.db
    .updateTable('central_news')
    .set(publish ? { status: 'published', published_by: admin.name, updated_at: nowIso() } : { status: 'draft', updated_at: nowIso() })
    .where('id', '=', id)
    .execute()
  await audit(ctx.db, admin, publish ? 'เผยแพร่ประกาศ 500WinTH & Co' : 'หยุดเผยแพร่ประกาศ 500WinTH & Co', row.title)
  return listNews(ctx)
}

export async function deleteNews(ctx: AppContext, admin: UserRow, id: string) {
  const row = await ctx.db.selectFrom('central_news').select('title').where('id', '=', id).executeTakeFirst()
  if (!row) throw notFound('ไม่พบประกาศนี้')
  await ctx.db.deleteFrom('central_news').where('id', '=', id).execute()
  await audit(ctx.db, admin, 'ลบประกาศ 500WinTH & Co', row.title)
  return listNews(ctx)
}
