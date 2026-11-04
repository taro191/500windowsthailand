// Promo bookings for windows 481–486: paid when submitted, reviewed by an admin (or approved at
// once when the content matches one approved before), refunded to the wallet if rejected.
// Owners can also save designs (templates) to book again without re-entering them.
import type { PromoAd, PromoDetails, PromoLayout, PromoRequest, PromoTemplate } from '@shared/promo'
import {
  cleanPromoDetails,
  emptyPromoDetails,
  freePromoRounds,
  isChoosableLayout,
  lastPromoDate,
  PROMO_MAX_IMAGES,
  PROMO_ROUND_OPTIONS,
  PROMO_ROUNDS_PER_DAY,
  PROMO_SIZES,
  PROMO_TEMPLATE_LIMIT,
  PROMO_TEMPLATE_MAX_BYTES,
  promoPrice,
  schedulePromoRounds,
} from '@shared/promo'
import { sixHourBlockIndex, thaiDayKey } from '@shared/thaiTime'
import { TRIAL_PROMO_LOCKED, trialOnly } from '@shared/trial'
import type { PromoRow, PromoTemplateRow, UserRow } from '../db/schema'
import { newId, sha256 } from '../lib/crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { deleteUpload, isDataUrl, saveImage, uploadSize } from '../lib/files'
import { nowIso, type AppContext } from '../context'
import { requireUserRow, selfDto } from './users'
import { payForPromo, type PaymentInput } from './purchases'
import { creditWallet, recordTransaction } from './ledger'
import { audit } from './audit'
import { getSettings } from './settings'

export function toPromoRequest(row: PromoRow): PromoRequest {
  const images = JSON.parse(row.images_json || '[]') as string[]
  return {
    id: row.id,
    userId: row.user_id,
    brand: row.brand,
    tagline: row.tagline,
    link: row.link,
    contact: row.contact,
    images,
    image: images[0] || '',
    details: { ...emptyPromoDetails(), ...(row.details_json ? (JSON.parse(row.details_json) as Partial<PromoDetails>) : {}) },
    layout: isChoosableLayout(row.layout) ? row.layout : undefined,
    size: row.size,
    price: row.price,
    rounds: row.rounds,
    durationHours: row.duration_hours,
    scheduleMode: row.schedule_mode,
    startDate: row.start_date,
    termsAccepted: true,
    termsAcceptedAt: row.terms_accepted_at,
    createdAt: row.created_at,
    status: row.status,
    payment: row.payment_json ? JSON.parse(row.payment_json) : undefined,
    refund: row.refund_json ? JSON.parse(row.refund_json) : undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
  }
}

/** Non-rejected bookings from today on with the rounds each one gets. */
async function bookedSchedule(db: AppContext['db']) {
  const rows = await db.selectFrom('promo_requests').selectAll().where('status', '!=', 'rejected').where('start_date', '>=', thaiDayKey()).execute()
  const bookings = rows.map((r) => ({ id: r.id, startDate: r.start_date, rounds: r.rounds, createdAt: r.created_at }))
  return { rows, ...schedulePromoRounds(bookings) }
}

/** Approved ads whose booked rounds are not over yet; the board shows each one only during its rounds. */
export async function activeAds(ctx: AppContext): Promise<PromoAd[]> {
  const { rows, schedule } = await bookedSchedule(ctx.db)
  const now = sixHourBlockIndex()
  return rows
    .filter((row) => row.status === 'approved')
    .map((row) => ({ row, rounds: schedule.get(row.id)! }))
    .filter(({ rounds }) => rounds.to > rounds.from && rounds.to > now)
    .sort((a, b) => a.rounds.from - b.rounds.from)
    .map(({ row, rounds }) => {
      const r = toPromoRequest(row)
      return { id: r.id, brand: r.brand, tagline: r.tagline, link: r.link, contact: r.contact, image: r.image, images: r.images, size: r.size, layout: r.layout, details: r.details, fromRound: rounds.from, toRound: rounds.to }
    })
}

/**
 * Rounds no longer bookable per date from today on (booked, or already past today), so the
 * web app can show what is left as `4 - n`. Today is always included.
 */
export async function reservedRounds(ctx: AppContext): Promise<Record<string, number>> {
  const { nextFree } = await bookedSchedule(ctx.db)
  const reserved: Record<string, number> = {}
  for (const date of new Set([thaiDayKey(), ...nextFree.keys()])) reserved[date] = PROMO_ROUNDS_PER_DAY - freePromoRounds(date, nextFree)
  return reserved
}

export async function myPromoRequests(ctx: AppContext, userId: string): Promise<PromoRequest[]> {
  const rows = await ctx.db.selectFrom('promo_requests').selectAll().where('user_id', '=', userId).orderBy('created_at', 'desc').execute()
  return rows.map(toPromoRequest)
}

/** What viewers see; equal hashes mean the same ad. */
interface PromoContent {
  brand: string
  tagline: string
  link: string
  contact: string
  images: string[]
  details: PromoDetails
  layout: PromoLayout | null
}

const contentHash = (c: PromoContent) => sha256(JSON.stringify([c.brand, c.tagline, c.link, c.contact, c.images, c.details, c.layout]))

/** Content hashes of the user's approved requests. */
async function approvedHashes(db: AppContext['db'], userId: string) {
  const rows = await db.selectFrom('promo_requests').select('content_hash').where('user_id', '=', userId).where('status', '=', 'approved').execute()
  return new Set(rows.map((r) => r.content_hash).filter(Boolean))
}

/** Stored promo images the user may reuse: those of their templates and requests. */
async function ownPromoImages(db: AppContext['db'], userId: string) {
  const [templates, requests] = await Promise.all([
    db.selectFrom('promo_templates').select('images_json').where('user_id', '=', userId).execute(),
    db.selectFrom('promo_requests').select('images_json').where('user_id', '=', userId).execute(),
  ])
  return new Set([...templates, ...requests].flatMap((r) => JSON.parse(r.images_json || '[]') as string[]))
}

/** Saves new images (data URLs) and checks reused ones belong to the user; returns the stored paths. */
async function storePromoImages(ctx: AppContext, userId: string, images: unknown[]) {
  const reused = images.filter((i) => !isDataUrl(String(i)))
  if (reused.length) {
    const own = await ownPromoImages(ctx.db, userId)
    if (reused.some((i) => !own.has(String(i)))) throw badRequest('รูปที่เลือกไม่ถูกต้อง กรุณาอัปโหลดรูปใหม่')
  }
  const paths: string[] = []
  for (const image of images) paths.push(isDataUrl(String(image)) ? await saveImage(ctx.config.uploadDir, String(image), 'promo') : String(image))
  return paths
}

/** Checks the content fields shared by requests and templates. */
function cleanContent(input: Partial<PromoInput> | undefined, size: number) {
  const brand = text(input?.brand, 120)
  const link = text(input?.link, 500)
  const images = Array.isArray(input?.images) ? input.images : []
  if (!brand) throw badRequest('กรุณาระบุชื่อแบรนด์หรือร้านค้า')
  if (link && !/^https?:\/\//i.test(link)) throw badRequest('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://')
  if (!PROMO_SIZES.includes(size)) throw badRequest('ขนาดพื้นที่โปรโมทไม่ถูกต้อง')
  if (images.length > Math.min(size, PROMO_MAX_IMAGES)) throw badRequest(`อัปโหลดรูปได้ไม่เกิน ${size} รูป`)
  const { details, error } = cleanPromoDetails(input?.details)
  if (error) throw badRequest(error)
  const layout = input?.layout ?? null
  if (layout !== null && !isChoosableLayout(layout)) throw badRequest('กรุณาเลือกรูปแบบการจัดวางช่อง')
  return { brand, link, images, details, layout, tagline: text(input?.tagline, 255), contact: text(input?.contact, 255) }
}

export interface PromoInput {
  brand: string
  tagline?: string
  link?: string
  contact?: string
  images?: string[]
  details?: Partial<PromoDetails>
  layout?: string
  size: number
  rounds: number
  scheduleMode: 'today' | 'calendar'
  startDate: string
  termsAccepted: boolean
}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

const AUTO_APPROVED_NOTE = 'อนุมัติอัตโนมัติ: ใช้แบบโปรโมทเดิมที่เคยอนุมัติแล้ว'

export async function submitPromoRequest(ctx: AppContext, user: UserRow, input: PromoInput, paymentInput: PaymentInput) {
  if (user.suspended) throw forbidden('บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน')
  const owned = await ctx.db.selectFrom('windows').select('trial_ends_at').where('owner_id', '=', user.id).execute()
  if (trialOnly(owned.map((w) => ({ trial: !!w.trial_ends_at })))) throw forbidden(TRIAL_PROMO_LOCKED)
  const size = Number(input?.size)
  const rounds = Number(input?.rounds)
  const startDate = text(input?.startDate, 10)
  const { brand, link, images, details, layout, tagline, contact } = cleanContent(input, size)
  if (!PROMO_ROUND_OPTIONS.includes(rounds)) throw badRequest('จำนวนรอบไม่ถูกต้อง')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate < thaiDayKey()) throw badRequest('กรุณาเลือกวันโปรโมทเป็นวันนี้หรือวันในอนาคต')
  if (input?.termsAccepted !== true) throw badRequest('กรุณายอมรับเงื่อนไขการโปรโมทก่อนส่งคำขอ')
  const { rules } = await getSettings(ctx)
  if (startDate > lastPromoDate(thaiDayKey(), rules.promoAdvanceDays)) throw badRequest(`จองโปรโมทล่วงหน้าได้ไม่เกิน ${rules.promoAdvanceDays} วัน`)

  const price = promoPrice(size, rounds, rules.promoPricePerWindowRound)
  const imageUrls = await storePromoImages(ctx, user.id, images)
  const hash = contentHash({ brand, tagline, link, contact, images: imageUrls, details, layout })

  const id = newId('promo')
  const now = nowIso()
  let autoApproved = false
  await ctx.db.transaction().execute(async (trx) => {
    await trx.updateTable('users').set({ updated_at: now }).where('id', '=', user.id).execute()
    const month = startDate.slice(0, 7)
    const booked = await trx
      .selectFrom('promo_requests')
      .select((eb) => eb.fn.sum<number>('rounds').as('n'))
      .where('user_id', '=', user.id)
      .where('status', '!=', 'rejected')
      .where('start_date', '>=', `${month}-01`)
      .where('start_date', '<=', `${month}-31`)
      .executeTakeFirst()
    const used = Number(booked?.n ?? 0)
    if (used + rounds > rules.promoMonthlyRounds)
      throw badRequest(`โปรโมทได้สูงสุด ${rules.promoMonthlyRounds} รอบต่อเดือน เดือนนี้คุณจองไปแล้ว ${used} รอบ เหลือ ${Math.max(0, rules.promoMonthlyRounds - used)} รอบ`)
    const { nextFree } = await bookedSchedule(trx)
    const free = freePromoRounds(startDate, nextFree)
    if (rounds > free) throw conflict(`วันที่ ${startDate} เหลือ ${free} รอบ กรุณาเลือกจำนวนรอบหรือวันอื่น`)
    const payment = await payForPromo(trx, ctx, { user, requestId: id, brand, size, rounds, price, paymentInput })
    // A slip still waits for an admin, so only a completed payment can be approved here.
    autoApproved = payment.orderStatus === 'approved' && (await approvedHashes(trx, user.id)).has(hash)
    await trx
      .insertInto('promo_requests')
      .values({
        id,
        user_id: user.id,
        brand,
        tagline,
        link,
        contact,
        images_json: JSON.stringify(imageUrls),
        details_json: JSON.stringify(details),
        layout,
        size,
        price,
        rounds,
        duration_hours: rounds * 6,
        schedule_mode: input.scheduleMode === 'calendar' ? 'calendar' : 'today',
        start_date: startDate,
        terms_accepted_at: now,
        created_at: now,
        status: autoApproved ? 'approved' : 'pending',
        payment_json: JSON.stringify(payment),
        refund_json: null,
        order_id: payment.orderId ?? null,
        decided_at: autoApproved ? now : null,
        decided_by: null,
        decision_note: autoApproved ? AUTO_APPROVED_NOTE : null,
        content_hash: hash,
      })
      .execute()
  })
  const row = await ctx.db.selectFrom('promo_requests').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return { request: toPromoRequest(row), user: selfDto(ctx, await requireUserRow(ctx, user.id)) }
}

/**
 * Admin decision on a paid request. The transfer slip (if any) must be checked first.
 * Rejecting refunds the full amount to the requester's wallet.
 */
export async function decidePromoRequest(ctx: AppContext, admin: UserRow, id: string, decision: 'approved' | 'rejected', note = '') {
  const reason = String(note ?? '').trim().slice(0, 500)
  return ctx.db.transaction().execute(async (trx) => {
    const row = await trx.selectFrom('promo_requests').selectAll().where('id', '=', id).executeTakeFirst()
    if (!row) throw notFound('ไม่พบคำขอ')
    if (row.status !== 'pending') throw conflict('คำขอนี้ถูกพิจารณาไปแล้ว')
    const request = toPromoRequest(row)
    if (request.payment?.orderStatus === 'pending') throw badRequest('กรุณาตรวจสอบสลิปค่าโปรโมทก่อน (เมนู "ตรวจสลิปชำระเงิน")')

    let refund: PromoRequest['refund']
    if (decision === 'rejected' && request.payment) {
      const requester = await trx.selectFrom('users').select(['id', 'name']).where('id', '=', row.user_id).executeTakeFirstOrThrow()
      const amount = request.payment.amount
      await creditWallet(trx, requester.id, amount)
      const transactionId = await recordTransaction(trx, {
        windowId: 0,
        windowCode: 'REFUND',
        region: 'thailand',
        windowTitle: `คืนค่าโปรโมท "${row.brand}" (ไม่อนุมัติ)`,
        fromOwner: 'พื้นที่โปรโมท 500 Windows',
        fromOwnerId: 'platform',
        toOwner: requester.name,
        toOwnerId: requester.id,
        amount,
        type: 'refund',
        walletAmount: amount,
        externalAmount: 0,
      })
      refund = { amount, at: nowIso(), transactionId }
    }
    const updated = await trx
      .updateTable('promo_requests')
      .set({
        status: decision,
        refund_json: refund ? JSON.stringify(refund) : null,
        decided_at: nowIso(),
        decided_by: admin.id,
        decision_note: reason || null,
      })
      .where('id', '=', id)
      .where('status', '=', 'pending')
      .executeTakeFirst()
    if (Number(updated.numUpdatedRows) === 0) throw conflict('คำขอนี้ถูกพิจารณาไปแล้ว')
    await audit(
      trx,
      admin,
      decision === 'approved' ? 'อนุมัติคำขอโปรโมท' : 'ไม่อนุมัติคำขอโปรโมท',
      refund ? `${row.brand} · คืนเงิน ฿${refund.amount.toLocaleString()} เข้ากระเป๋า${reason ? ` · ${reason}` : ''}` : row.brand,
    )
    return { refunded: refund?.amount }
  })
}

// ---------------------------------------------------------------- saved designs

function toPromoTemplate(row: PromoTemplateRow, approved: Set<string | null>): PromoTemplate {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    tagline: row.tagline,
    link: row.link,
    contact: row.contact,
    images: JSON.parse(row.images_json || '[]') as string[],
    details: { ...emptyPromoDetails(), ...(JSON.parse(row.details_json || '{}') as Partial<PromoDetails>) },
    layout: isChoosableLayout(row.layout) ? row.layout : undefined,
    size: row.size,
    bytes: row.bytes,
    approved: approved.has(row.content_hash),
    updatedAt: row.updated_at,
  }
}

export async function myPromoTemplates(ctx: AppContext, userId: string): Promise<PromoTemplate[]> {
  const [rows, approved] = await Promise.all([
    ctx.db.selectFrom('promo_templates').selectAll().where('user_id', '=', userId).orderBy('updated_at', 'desc').execute(),
    approvedHashes(ctx.db, userId),
  ])
  return rows.map((r) => toPromoTemplate(r, approved))
}

/** Deletes promo image files the user no longer uses in any template or request. */
async function pruneImages(ctx: AppContext, userId: string, candidates: string[]) {
  if (!candidates.length) return
  const own = await ownPromoImages(ctx.db, userId)
  for (const path of candidates) if (!own.has(path)) await deleteUpload(ctx.config.uploadDir, path)
}

export type PromoTemplateInput = Partial<PromoInput> & { name?: string }

/** Creates a template, or replaces template `id`; images count toward the per-user storage limit. */
export async function savePromoTemplate(ctx: AppContext, user: UserRow, input: PromoTemplateInput, id?: string) {
  const size = Number(input?.size)
  const content = cleanContent(input, size)
  const existing = id ? await ctx.db.selectFrom('promo_templates').selectAll().where('id', '=', id).where('user_id', '=', user.id).executeTakeFirst() : undefined
  if (id && !existing) throw notFound('ไม่พบแบบโปรโมทนี้')
  const others = await ctx.db.selectFrom('promo_templates').select(['id', 'bytes']).where('user_id', '=', user.id).execute()
  if (!existing && others.length >= PROMO_TEMPLATE_LIMIT) throw badRequest(`บันทึกแบบโปรโมทได้สูงสุด ${PROMO_TEMPLATE_LIMIT} แบบ กรุณาลบแบบเดิมก่อน`)

  const images = await storePromoImages(ctx, user.id, content.images)
  const fresh = images.filter((_, i) => isDataUrl(String(content.images[i])))
  let bytes = 0
  for (const p of images) bytes += await uploadSize(ctx.config.uploadDir, p)
  const usedElsewhere = others.filter((t) => t.id !== id).reduce((sum, t) => sum + t.bytes, 0)
  if (usedElsewhere + bytes > PROMO_TEMPLATE_MAX_BYTES) {
    for (const p of fresh) await deleteUpload(ctx.config.uploadDir, p)
    throw badRequest(`พื้นที่เก็บแบบโปรโมทเต็ม (สูงสุด ${PROMO_TEMPLATE_MAX_BYTES / 1024 / 1024} MB) กรุณาลบแบบหรือรูปที่ไม่ใช้`)
  }

  const now = nowIso()
  const values = {
    name: text(input?.name, 60) || content.brand,
    brand: content.brand,
    tagline: content.tagline,
    link: content.link,
    contact: content.contact,
    images_json: JSON.stringify(images),
    details_json: JSON.stringify(content.details),
    layout: content.layout,
    size,
    bytes,
    content_hash: contentHash({ ...content, images }),
    updated_at: now,
  }
  const templateId = existing?.id ?? newId('ptpl')
  if (existing) await ctx.db.updateTable('promo_templates').set(values).where('id', '=', existing.id).execute()
  else await ctx.db.insertInto('promo_templates').values({ ...values, id: templateId, user_id: user.id, created_at: now }).execute()
  if (existing) await pruneImages(ctx, user.id, (JSON.parse(existing.images_json) as string[]).filter((p) => !images.includes(p)))
  const templates = await myPromoTemplates(ctx, user.id)
  return { template: templates.find((t) => t.id === templateId)!, templates }
}

export async function deletePromoTemplate(ctx: AppContext, user: UserRow, id: string) {
  const row = await ctx.db.selectFrom('promo_templates').selectAll().where('id', '=', id).where('user_id', '=', user.id).executeTakeFirst()
  if (!row) throw notFound('ไม่พบแบบโปรโมทนี้')
  await ctx.db.deleteFrom('promo_templates').where('id', '=', id).execute()
  await pruneImages(ctx, user.id, JSON.parse(row.images_json) as string[])
  return { templates: await myPromoTemplates(ctx, user.id) }
}
