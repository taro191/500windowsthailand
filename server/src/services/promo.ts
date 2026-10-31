// Promo bookings for windows 481–486: paid when submitted, reviewed by an admin,
// refunded to the wallet if rejected.
import type { PromoAd, PromoDetails, PromoRequest } from '@shared/promo'
import { cleanPromoDetails, emptyPromoDetails, freePromoRounds, isChoosableLayout, PROMO_MAX_IMAGES, PROMO_ROUND_OPTIONS, PROMO_ROUNDS_PER_DAY, PROMO_SIZES, promoPrice, schedulePromoRounds } from '@shared/promo'
import { sixHourBlockIndex, thaiDayKey } from '@shared/thaiTime'
import type { PromoRow, UserRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { saveImage } from '../lib/files'
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

export async function submitPromoRequest(ctx: AppContext, user: UserRow, input: PromoInput, paymentInput: PaymentInput) {
  if (user.suspended) throw forbidden('บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน')
  const brand = text(input?.brand, 120)
  const link = text(input?.link, 500)
  const size = Number(input?.size)
  const rounds = Number(input?.rounds)
  const startDate = text(input?.startDate, 10)
  const images = Array.isArray(input?.images) ? input.images : []
  if (!brand) throw badRequest('กรุณาระบุชื่อแบรนด์หรือร้านค้า')
  if (link && !/^https?:\/\//i.test(link)) throw badRequest('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://')
  if (!PROMO_SIZES.includes(size)) throw badRequest('ขนาดพื้นที่โปรโมทไม่ถูกต้อง')
  if (!PROMO_ROUND_OPTIONS.includes(rounds)) throw badRequest('จำนวนรอบไม่ถูกต้อง')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate < thaiDayKey()) throw badRequest('กรุณาเลือกวันโปรโมทเป็นวันนี้หรือวันในอนาคต')
  if (images.length > Math.min(size, PROMO_MAX_IMAGES)) throw badRequest(`อัปโหลดรูปได้ไม่เกิน ${size} รูป`)
  if (input?.termsAccepted !== true) throw badRequest('กรุณายอมรับเงื่อนไขการโปรโมทก่อนส่งคำขอ')
  const { details, error } = cleanPromoDetails(input?.details)
  if (error) throw badRequest(error)
  const layout = input?.layout ?? null
  if (layout !== null && !isChoosableLayout(layout)) throw badRequest('กรุณาเลือกรูปแบบการจัดวางช่อง')

  const price = promoPrice(size, rounds, (await getSettings(ctx)).rules.promoPricePerWindowRound)
  const imageUrls: string[] = []
  for (const image of images) imageUrls.push(await saveImage(ctx.config.uploadDir, String(image), 'promo'))

  const id = newId('promo')
  const now = nowIso()
  await ctx.db.transaction().execute(async (trx) => {
    await trx.updateTable('users').set({ updated_at: now }).where('id', '=', user.id).execute()
    const { nextFree } = await bookedSchedule(trx)
    const free = freePromoRounds(startDate, nextFree)
    if (rounds > free) throw conflict(`วันที่ ${startDate} เหลือ ${free} รอบ กรุณาเลือกจำนวนรอบหรือวันอื่น`)
    const payment = await payForPromo(trx, ctx, { user, requestId: id, brand, size, rounds, price, paymentInput })
    await trx
      .insertInto('promo_requests')
      .values({
        id,
        user_id: user.id,
        brand,
        tagline: text(input.tagline, 255),
        link,
        contact: text(input.contact, 255),
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
        status: 'pending',
        payment_json: JSON.stringify(payment),
        refund_json: null,
        order_id: payment.orderId ?? null,
        decided_at: null,
        decided_by: null,
        decision_note: null,
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
