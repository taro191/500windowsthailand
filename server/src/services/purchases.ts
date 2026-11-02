// Everything that moves money: claiming a window, buying a resale, topping up the wallet,
// paying for a promo, and an admin approving or rejecting a transfer slip.
//
// Payment = wallet part + external part (one channel). The wallet part is taken right away.
// A card payment (simulated until a gateway is chosen) completes immediately; a transfer
// creates a pending payment order: the window is held for the buyer and the purchase
// completes when an admin approves the slip. Rejecting returns the wallet part.
import type { PaymentChannel, PaymentOrder, PaymentOrderKind, PlatformSettings, RegionId, User } from '@shared/types'
import { commissionRate, enabledChannels, resaleCommission, SLIP_CHANNEL_TYPES } from '@shared/settings'
import { REGIONS_BY_ID } from '@shared/regions'
import { isPromoSlot } from '@shared/promo'
import { buildQuota } from '@shared/windowQuota'
import { isPaidOnly } from '@shared/paidOnly'
import { REFUND_DAYS, TRIAL_GRACE_DAYS, trialEndsAt, trialPhase } from '@shared/trial'
import type { DB } from '../db'
import type { OrderRow, UserRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { saveImage } from '../lib/files'
import { nowIso, type AppContext } from '../context'
import { getSettings } from './settings'
import { assertCanTrade, extraWindowsOf, parseTrialArchive, requireUserRow, selfDto, type TrialArchive } from './users'
import { cleanContent, emptyWindowRow, insertImage, refundDeadline, resolveImage, type WindowContentInput } from './windows'
import { creditWallet, debitWallet, recordTransaction } from './ledger'
import { audit } from './audit'

export interface PaymentInput {
  walletAmount: number
  externalAmount: number
  channelId?: string
  /** Transfer slip image as a data URL, for bank / PromptPay / TrueMoney. */
  slip?: { slipUrl: string; slipRef?: string }
}

interface CheckedPayment {
  walletAmount: number
  externalAmount: number
  channel?: PaymentChannel
  /** External part waits for an admin to check the slip. */
  viaSlip: boolean
  slipUrl?: string
  slipRef?: string
}

const isWholeBaht = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0
const reference = (prefix: string) => `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 9000 + 1000)}`

/** Validates the split and the external channel; saves the slip image. */
async function checkPayment(ctx: AppContext, price: number, input: PaymentInput): Promise<CheckedPayment> {
  const walletAmount = input?.walletAmount
  const externalAmount = input?.externalAmount
  if (!isWholeBaht(walletAmount) || !isWholeBaht(externalAmount)) throw badRequest('ยอดชำระไม่ถูกต้อง')
  if (walletAmount + externalAmount !== price) {
    throw badRequest(`ยอดชำระรวม (฿${(walletAmount + externalAmount).toLocaleString()}) ไม่ตรงกับราคา ฿${price.toLocaleString()}`)
  }
  if (externalAmount === 0) return { walletAmount, externalAmount, viaSlip: false }

  const channel = enabledChannels(await getSettings(ctx)).find((c) => c.id === input.channelId)
  if (!channel) throw badRequest('กรุณาเลือกช่องทางชำระเงินสำหรับยอดที่เหลือ')
  if (channel.type === 'card') {
    if (ctx.config.cardPayments !== 'simulated') throw badRequest('ยังไม่เปิดรับชำระด้วยบัตร กรุณาเลือกช่องทางอื่น')
    return { walletAmount, externalAmount, channel, viaSlip: false, slipRef: reference('CARD') }
  }
  if (!SLIP_CHANNEL_TYPES.includes(channel.type)) throw badRequest('ช่องทางชำระเงินไม่ถูกต้อง')
  if (!input.slip?.slipUrl) throw badRequest('กรุณาแนบสลิปการโอนเงินสำหรับยอดที่เหลือ')
  const slipUrl = await saveImage(ctx.config.uploadDir, input.slip.slipUrl, 'slips')
  const slipRef = String(input.slip.slipRef ?? '').trim().slice(0, 80) || reference('SLIP')
  return { walletAmount, externalAmount, channel, viaSlip: true, slipUrl, slipRef }
}

const paymentFields = (p: CheckedPayment, orderId?: string | null) => ({
  walletAmount: p.walletAmount,
  externalAmount: p.externalAmount,
  channelName: p.externalAmount > 0 ? p.channel?.name : undefined,
  slipRef: p.slipRef,
  orderId: orderId ?? undefined,
})

async function insertOrder(
  db: DB,
  values: {
    id: string
    user: UserRow
    kind: PaymentOrderKind
    label: string
    amount: number
    payment: CheckedPayment
    status: 'pending' | 'approved'
    payload?: unknown
    region?: RegionId
    num?: number
    promoRequestId?: string
  },
) {
  const now = nowIso()
  await db
    .insertInto('payment_orders')
    .values({
      id: values.id,
      user_id: values.user.id,
      kind: values.kind,
      label: values.label.slice(0, 255),
      amount: values.amount,
      wallet_amount: values.payment.walletAmount,
      external_amount: values.payment.externalAmount,
      channel_id: values.payment.channel?.id ?? null,
      channel_name: values.payment.channel?.name ?? null,
      slip_url: values.payment.slipUrl ?? null,
      slip_ref: values.payment.slipRef ?? null,
      status: values.status,
      payload_json: values.payload === undefined ? null : JSON.stringify(values.payload),
      region: values.region ?? null,
      window_num: values.num ?? null,
      promo_request_id: values.promoRequestId ?? null,
      created_at: now,
      decided_at: values.status === 'approved' ? now : null,
      decided_by: null,
      note: null,
    })
    .execute()
}

export function toOrder(row: OrderRow, userName = ''): PaymentOrder {
  return {
    id: row.id,
    userId: row.user_id,
    userName,
    kind: row.kind,
    label: row.label,
    amount: row.amount,
    walletAmount: row.wallet_amount,
    externalAmount: row.external_amount,
    channelId: row.channel_id ?? undefined,
    channelName: row.channel_name ?? undefined,
    slipUrl: row.slip_url ?? undefined,
    slipRef: row.slip_ref ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at ?? undefined,
    decidedBy: row.decided_by ?? undefined,
    note: row.note ?? undefined,
    region: (row.region as RegionId) ?? undefined,
    windowId: row.window_num ?? undefined,
    promoRequestId: row.promo_request_id ?? undefined,
  }
}

/**
 * Serialises one user's purchases: touching the user row takes a row lock in MySQL
 * (SQLite runs transactions one at a time anyway), so two tabs can't both pass the quota check.
 */
async function lockUser(db: DB, userId: string) {
  await db.updateTable('users').set({ updated_at: nowIso() }).where('id', '=', userId).execute()
}

/** Max 1 window on the Thailand board + 1 regional, plus the user's admin-granted extra; pending orders count too. */
async function assertQuota(db: DB, userId: string, region: RegionId) {
  const user = await db
    .selectFrom('users')
    .select(['extra_thailand_windows', 'extra_regional_windows'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()
  const owned = await db.selectFrom('windows').select(['region', 'code']).where('owner_id', '=', userId).execute()
  const pending = await db
    .selectFrom('payment_orders')
    .select(['region', 'label'])
    .where('user_id', '=', userId)
    .where('status', '=', 'pending')
    .where('kind', 'in', ['claim', 'resale'])
    .execute()
  const held = [...owned.map((w) => ({ region: w.region, code: w.code })), ...pending.map((o) => ({ region: o.region, code: `${o.label} (รอตรวจสลิป)` }))]
  const quota = buildQuota(held, extraWindowsOf(user))
  const refuse = (reason: string) => forbidden(reason, { quotaExceeded: true })
  if (region === 'thailand' && !quota.canAcquireThailand) {
    const current = quota.thailandLimit === 1 ? `ปัจจุบันคุณถือครองแล้ว: ${quota.thailandWindow?.code}` : `ปัจจุบันคุณถือครองแล้ว ${quota.thailandCount} บาน`
    throw refuse(`ไม่สามารถถือครองเพิ่มได้: คุณมี "หน้าต่างบานประเทศไทย" ได้ไม่เกิน ${quota.thailandLimit} บาน (${current})`)
  }
  if (region !== 'thailand' && !quota.canAcquireRegional) {
    const first = quota.regionalWindow
    const where = (first && REGIONS_BY_ID[first.region as RegionId]?.name) ?? 'ภูมิภาค'
    const current = quota.regionalLimit === 1 ? `ปัจจุบันคุณถือครองแล้วใน${where}: ${first?.code}` : `ปัจจุบันคุณถือครองแล้ว ${quota.regionalCount} บาน`
    throw refuse(`ไม่สามารถถือครองเพิ่มได้: คุณมี "หน้าต่างบานภูมิภาค" ได้ไม่เกิน ${quota.regionalLimit} บาน (${current})`)
  }
}

export interface PurchaseResult {
  /** True when the purchase waits for an admin to check the transfer slip. */
  pending: boolean
  order?: PaymentOrder
  user: User
}

async function result(ctx: AppContext, userId: string, pending: boolean, orderId?: string | null): Promise<PurchaseResult> {
  const row = await requireUserRow(ctx, userId)
  const order = orderId ? await ctx.db.selectFrom('payment_orders').selectAll().where('id', '=', orderId).executeTakeFirst() : undefined
  return { pending, order: order ? toOrder(order, row.name) : undefined, user: selfDto(ctx, row) }
}

// ---------------------------------------------------------------- claim

interface ClaimPayload {
  title: string
  description: string
  category: string
  province: string
  owner_contact: string | null
  external_link: string | null
  imageUrl: string
  /** Restored from the user's released trial window (users.trial_archive_json). */
  profile_json?: string | null
  restoredTrial?: true
}

async function applyClaim(
  db: DB,
  args: { buyer: Pick<UserRow, 'id' | 'name'>; region: RegionId; num: number; price: number; content: ClaimPayload; payment: CheckedPayment; orderId?: string | null; heldBy?: string },
) {
  const now = nowIso()
  const { content } = args
  let update = db
    .updateTable('windows')
    .set({
      title: content.title,
      description: content.description,
      category: content.category,
      province: content.province,
      image_url: content.imageUrl,
      owner_id: args.buyer.id,
      owner_contact: content.owner_contact,
      external_link: content.external_link,
      profile_json: content.profile_json ?? null,
      status: 'occupied',
      resale_price: null,
      claimed_at: now,
      owner_changed_at: now,
      owner_change_kind: 'new',
      last_purchase_price: args.price,
      last_image_updated_at: now,
      edit_day: null,
      edit_count: 0,
      note_day: null,
      note_text: null,
      note_at: null,
      reserved_order_id: null,
      welcomed_at: null,
      content_updated_at: now,
      // The claim form already holds the content the buyer chose to show.
      published_at: now,
      taken_down_at: null,
      takedown_reason: null,
      updated_at: now,
    })
    .where('region', '=', args.region)
    .where('num', '=', args.num)
  update = args.heldBy
    ? update.where('reserved_order_id', '=', args.heldBy)
    : update.where('status', '=', 'available').where('owner_id', 'is', null).where('reserved_order_id', 'is', null)
  const updated = await update.executeTakeFirst()
  if (Number(updated.numUpdatedRows) === 0) throw conflict('หน้าต่างนี้มีผู้จับจองแล้ว')

  await insertImage(db, args.region, args.num, content.imageUrl, 'ภาพเปิดตัวหน้าต่างบานใหม่', now)
  if (content.restoredTrial) await db.updateTable('users').set({ trial_archive_json: null }).where('id', '=', args.buyer.id).execute()
  const code = `${REGIONS_BY_ID[args.region].codePrefix}-${String(args.num).padStart(3, '0')}`
  await recordTransaction(db, {
    windowId: args.num,
    windowCode: code,
    region: args.region,
    windowTitle: content.title,
    fromOwner: `โครงการหน้าต่างประเทศไทย 500 บาน (${args.region})`,
    toOwner: args.buyer.name,
    toOwnerId: args.buyer.id,
    amount: args.price,
    type: 'claim',
    ...paymentFields(args.payment, args.orderId),
  })
}

/** Claim an available window (at the claim price in settings.rules) with its first content. */
export async function claimWindow(
  ctx: AppContext,
  user: UserRow,
  region: RegionId,
  num: number,
  input: WindowContentInput,
  paymentInput: PaymentInput,
  restoreTrial = false,
): Promise<PurchaseResult> {
  assertCanTrade(user)
  if (isPromoSlot(num)) throw badRequest('หน้าต่างหมายเลข 481–486 ล็อกไว้เป็นพื้นที่โปรโมทของระบบ')
  const row = await ctx.db.selectFrom('windows').selectAll().where('region', '=', region).where('num', '=', num).executeTakeFirst()
  if (!row) throw notFound('ไม่พบบานหน้าต่างที่ต้องการ')
  if (row.status !== 'available' || row.owner_id || row.reserved_order_id) throw conflict('หน้าต่างนี้มีผู้จับจองแล้ว')
  if (!input?.imageUrl) throw badRequest('กรุณาเลือกรูปภาพสำหรับหน้าต่าง')

  const archive = restoreTrial ? parseTrialArchive(user) : undefined
  if (restoreTrial && !archive) throw badRequest('ไม่พบข้อมูลบานทดลองใช้เดิมที่จะกู้คืน')
  const cleaned = cleanContent(input, region)
  const price = row.claim_price
  const payment = await checkPayment(ctx, price, paymentInput)
  const content: ClaimPayload = {
    title: cleaned.title || `หน้าต่างของ ${user.name}`,
    description: cleaned.description || 'บันทึกภาพถ่ายและเรื่องราวส่วนตัว',
    category: cleaned.category,
    province: cleaned.province,
    owner_contact: cleaned.owner_contact,
    external_link: cleaned.external_link,
    imageUrl: archive && input.imageUrl === archive.image_url ? archive.image_url : await resolveImage(ctx, input.imageUrl),
    ...(archive ? { profile_json: archive.profile_json, restoredTrial: true as const } : {}),
  }

  const orderId = payment.externalAmount > 0 ? newId('ord') : null
  await ctx.db.transaction().execute(async (trx) => {
    await lockUser(trx, user.id)
    await assertQuota(trx, user.id, region)
    await debitWallet(trx, user.id, payment.walletAmount)
    const label = `จับจองบาน ${row.code}`
    if (payment.viaSlip) {
      const held = await trx
        .updateTable('windows')
        .set({ reserved_order_id: orderId, updated_at: nowIso() })
        .where('region', '=', region)
        .where('num', '=', num)
        .where('status', '=', 'available')
        .where('owner_id', 'is', null)
        .where('reserved_order_id', 'is', null)
        .executeTakeFirst()
      if (Number(held.numUpdatedRows) === 0) throw conflict('หน้าต่างนี้มีผู้จับจองแล้ว')
      await insertOrder(trx, { id: orderId!, user, kind: 'claim', label, amount: price, payment, status: 'pending', payload: content, region, num })
      return
    }
    if (orderId) await insertOrder(trx, { id: orderId, user, kind: 'claim', label, amount: price, payment, status: 'approved', region, num })
    await applyClaim(trx, { buyer: user, region, num, price, content, payment, orderId })
  })
  return result(ctx, user.id, payment.viaSlip, orderId)
}

// ---------------------------------------------------------------- free trial window

/** Start the user's one free trial on an available window: held and built privately for TRIAL_DAYS. */
/**
 * Owner's refund within REFUND_DAYS of paying the system for the window, while Friend and Co
 * hasn't been used from it: the full price goes back to the wallet and the window to the pool.
 */
export async function refundWindow(ctx: AppContext, user: UserRow, region: RegionId, num: number) {
  assertCanTrade(user)
  const row = await ctx.db.selectFrom('windows').selectAll().where('region', '=', region).where('num', '=', num).executeTakeFirst()
  if (!row) throw notFound('ไม่พบบานหน้าต่าง')
  if (row.owner_id !== user.id) throw forbidden('คุณไม่ใช่เจ้าของหน้าต่างบานนี้')
  if (row.suspended_at) throw forbidden('หน้าต่างนี้ถูกระงับชั่วคราว อยู่ระหว่างรอการตรวจสอบจากทีมงาน')
  if (!refundDeadline(row)) throw badRequest(`ขอคืนเงินได้เฉพาะบานที่ซื้อจากระบบ ภายใน ${REFUND_DAYS} วันนับจากวันชำระ`)
  const claimedAt = row.claimed_at!
  const usedFriend = await ctx.db
    .selectFrom('window_links')
    .select('id')
    .where((eb) =>
      eb.or([
        eb.and([eb('region', '=', region), eb('num', '=', num), eb('owner_id', '=', user.id)]),
        eb.and([eb('from_region', '=', region), eb('from_num', '=', num), eb('from_owner_id', '=', user.id)]),
      ]),
    )
    .where('created_at', '>=', claimedAt)
    .executeTakeFirst()
  if (usedFriend) throw badRequest('บานนี้ใช้ Friend and Co ไปแล้ว จึงขอคืนเงินไม่ได้')

  const amount = row.last_purchase_price!
  const now = nowIso()
  const { claimPrice } = (await getSettings(ctx)).rules
  await ctx.db.transaction().execute(async (trx) => {
    const { region: _r, num: _n, ...empty } = emptyWindowRow(region, num, now, claimPrice)
    const released = await trx
      .updateTable('windows')
      .set({ ...empty, previous_owner_id: user.id })
      .where('region', '=', region)
      .where('num', '=', num)
      .where('owner_id', '=', user.id)
      .where('claimed_at', '=', claimedAt)
      .executeTakeFirst()
    if (Number(released.numUpdatedRows) === 0) throw conflict('บานนี้เพิ่งมีการเปลี่ยนแปลง กรุณาลองใหม่อีกครั้ง')
    await trx.insertInto('window_owners').values({ id: newId('wo'), region, num, owner_id: user.id, transferred_at: now, type: 'released' }).execute()
    await trx.deleteFrom('window_follows').where('region', '=', region).where('num', '=', num).execute()
    await creditWallet(trx, user.id, amount)
    await recordTransaction(trx, {
      windowId: num,
      windowCode: row.code,
      region,
      windowTitle: `คืนเงินค่าจับจอง "${row.title}" (คืนบานภายใน ${REFUND_DAYS} วัน)`,
      fromOwner: '500 Windows Thailand',
      fromOwnerId: 'platform',
      toOwner: user.name,
      toOwnerId: user.id,
      amount,
      type: 'refund',
      walletAmount: amount,
      externalAmount: 0,
    })
  })
  return { amount, user: selfDto(ctx, await requireUserRow(ctx, user.id)) }
}

const PAID_ONLY = 'หน้าต่างหมายเลขนี้สงวนไว้สำหรับผู้ใช้งานจริง (ชำระเงิน) ทดลองใช้ฟรีกับบานนี้ไม่ได้ กรุณาเลือกบานอื่น'

export async function startTrial(ctx: AppContext, user: UserRow, region: RegionId, num: number, input: WindowContentInput) {
  assertCanTrade(user)
  if (user.trial_used_at) throw forbidden('คุณใช้สิทธิ์ทดลองใช้ฟรีไปแล้ว (1 บานต่อ 1 บัญชี)')
  if (isPromoSlot(num)) throw badRequest('หน้าต่างหมายเลข 481–486 ล็อกไว้เป็นพื้นที่โปรโมทของระบบ')
  const row = await ctx.db.selectFrom('windows').selectAll().where('region', '=', region).where('num', '=', num).executeTakeFirst()
  if (!row) throw notFound('ไม่พบบานหน้าต่างที่ต้องการ')
  if (row.status !== 'available' || row.owner_id || row.reserved_order_id) throw conflict('หน้าต่างนี้มีผู้จับจองแล้ว')
  if (isPaidOnly(row.code, (await getSettings(ctx)).paidOnly.codes)) throw forbidden(PAID_ONLY)
  if (!input?.imageUrl) throw badRequest('กรุณาเลือกรูปภาพสำหรับหน้าต่าง')
  const cleaned = cleanContent(input, region)
  const imageUrl = await resolveImage(ctx, input.imageUrl)

  const now = nowIso()
  await ctx.db.transaction().execute(async (trx) => {
    await lockUser(trx, user.id)
    const used = await trx.selectFrom('users').select('trial_used_at').where('id', '=', user.id).executeTakeFirstOrThrow()
    if (used.trial_used_at) throw forbidden('คุณใช้สิทธิ์ทดลองใช้ฟรีไปแล้ว (1 บานต่อ 1 บัญชี)')
    await assertQuota(trx, user.id, region)
    const updated = await trx
      .updateTable('windows')
      .set({
        title: cleaned.title || `หน้าต่างของ ${user.name}`,
        description: cleaned.description || 'บันทึกภาพถ่ายและเรื่องราวส่วนตัว',
        category: cleaned.category,
        province: cleaned.province,
        image_url: imageUrl,
        owner_id: user.id,
        owner_contact: cleaned.owner_contact,
        external_link: cleaned.external_link,
        profile_json: null,
        status: 'occupied',
        resale_price: null,
        claimed_at: now,
        owner_changed_at: now,
        owner_change_kind: 'new',
        last_purchase_price: null,
        last_image_updated_at: now,
        edit_day: null,
        edit_count: 0,
        note_day: null,
        note_text: null,
        note_at: null,
        welcomed_at: null,
        content_updated_at: now,
        published_at: null,
        taken_down_at: null,
        takedown_reason: null,
        trial_ends_at: trialEndsAt(new Date(now)).toISOString(),
        updated_at: now,
      })
      .where('region', '=', region)
      .where('num', '=', num)
      .where('status', '=', 'available')
      .where('owner_id', 'is', null)
      .where('reserved_order_id', 'is', null)
      .executeTakeFirst()
    if (Number(updated.numUpdatedRows) === 0) throw conflict('หน้าต่างนี้มีผู้จับจองแล้ว')
    await trx.updateTable('users').set({ trial_used_at: now }).where('id', '=', user.id).execute()
    await insertImage(trx, region, num, imageUrl, 'ภาพเปิดตัวหน้าต่างบานใหม่', now)
  })
}

/** Pay the claim price for one's trial window (during the trial or the "รอชำระเงิน" period). */
export async function payTrial(ctx: AppContext, user: UserRow, region: RegionId, num: number, paymentInput: PaymentInput): Promise<PurchaseResult> {
  assertCanTrade(user)
  const row = await ctx.db.selectFrom('windows').selectAll().where('region', '=', region).where('num', '=', num).executeTakeFirst()
  if (!row) throw notFound('ไม่พบบานหน้าต่าง')
  if (row.owner_id !== user.id || !row.trial_ends_at) throw badRequest('บานนี้ไม่ใช่บานทดลองใช้ของคุณ')
  if (row.reserved_order_id) throw conflict('มีรายการชำระเงินของบานนี้รอตรวจสอบอยู่แล้ว')
  if (trialPhase(row.trial_ends_at) === 'expired') throw badRequest('เลยกำหนดชำระเงินของบานทดลองใช้แล้ว')

  const price = row.claim_price
  const payment = await checkPayment(ctx, price, paymentInput)
  const orderId = payment.externalAmount > 0 ? newId('ord') : null
  await ctx.db.transaction().execute(async (trx) => {
    await lockUser(trx, user.id)
    await debitWallet(trx, user.id, payment.walletAmount)
    const label = `ชำระค่าจับจองบานทดลอง ${row.code}`
    if (payment.viaSlip) {
      const held = await trx
        .updateTable('windows')
        .set({ reserved_order_id: orderId })
        .where('region', '=', region)
        .where('num', '=', num)
        .where('owner_id', '=', user.id)
        .where('trial_ends_at', 'is not', null)
        .where('reserved_order_id', 'is', null)
        .executeTakeFirst()
      if (Number(held.numUpdatedRows) === 0) throw conflict('มีรายการชำระเงินของบานนี้รอตรวจสอบอยู่แล้ว')
      await insertOrder(trx, { id: orderId!, user, kind: 'claim', label, amount: price, payment, status: 'pending', payload: { trial: true }, region, num })
      return
    }
    if (orderId) await insertOrder(trx, { id: orderId, user, kind: 'claim', label, amount: price, payment, status: 'approved', region, num })
    await applyTrialPayment(trx, { buyer: user, region, num, price, payment, orderId })
  })
  return result(ctx, user.id, payment.viaSlip, orderId)
}

/** The trial window becomes a normal paid window and is published right away. */
async function applyTrialPayment(
  db: DB,
  args: { buyer: Pick<UserRow, 'id' | 'name'>; region: RegionId; num: number; price: number; payment: CheckedPayment; orderId?: string | null; heldBy?: string },
) {
  const now = nowIso()
  let update = db
    .updateTable('windows')
    .set({ trial_ends_at: null, claimed_at: now, owner_changed_at: now, last_purchase_price: args.price, reserved_order_id: null, published_at: now, content_updated_at: now, updated_at: now })
    .where('region', '=', args.region)
    .where('num', '=', args.num)
    .where('owner_id', '=', args.buyer.id)
    .where('trial_ends_at', 'is not', null)
  update = args.heldBy ? update.where('reserved_order_id', '=', args.heldBy) : update.where('reserved_order_id', 'is', null)
  const updated = await update.executeTakeFirst()
  if (Number(updated.numUpdatedRows) === 0) throw conflict('บานทดลองใช้นี้ไม่อยู่ในสถานะรอชำระเงินแล้ว')

  const row = await db.selectFrom('windows').select(['code', 'title']).where('region', '=', args.region).where('num', '=', args.num).executeTakeFirstOrThrow()
  await recordTransaction(db, {
    windowId: args.num,
    windowCode: row.code,
    region: args.region,
    windowTitle: row.title,
    fromOwner: `โครงการหน้าต่างประเทศไทย 500 บาน (${args.region})`,
    toOwner: args.buyer.name,
    toOwnerId: args.buyer.id,
    amount: args.price,
    type: 'claim',
    ...paymentFields(args.payment, args.orderId),
  })
}

/**
 * Trial windows still unpaid after the "รอชำระเงิน" period go back to the pool; their content is kept on
 * the user (trial_archive_json) to restore into another window. Windows with a slip waiting are skipped.
 */
export async function expireTrials(ctx: AppContext, now = new Date()) {
  const cutoff = new Date(now.getTime() - TRIAL_GRACE_DAYS * 86_400_000).toISOString()
  const rows = await ctx.db
    .selectFrom('windows')
    .selectAll()
    .where('trial_ends_at', 'is not', null)
    .where('trial_ends_at', '<=', cutoff)
    .where('reserved_order_id', 'is', null)
    .execute()
  if (!rows.length) return 0
  const { claimPrice } = (await getSettings(ctx)).rules
  const at = now.toISOString()
  for (const row of rows) {
    await ctx.db.transaction().execute(async (trx) => {
      const { region: _r, num: _n, ...empty } = emptyWindowRow(row.region as RegionId, row.num, at, claimPrice)
      const released = await trx
        .updateTable('windows')
        .set({ ...empty, previous_owner_id: row.owner_id })
        .where('region', '=', row.region)
        .where('num', '=', row.num)
        .where('owner_id', '=', row.owner_id)
        .where('trial_ends_at', '=', row.trial_ends_at)
        .where('reserved_order_id', 'is', null)
        .executeTakeFirst()
      if (Number(released.numUpdatedRows) === 0 || !row.owner_id) return
      const archive: TrialArchive = {
        code: row.code,
        title: row.title,
        description: row.description,
        category: row.category,
        province: row.province,
        image_url: row.image_url,
        owner_contact: row.owner_contact,
        external_link: row.external_link,
        profile_json: row.profile_json,
        archived_at: at,
      }
      await trx.updateTable('users').set({ trial_archive_json: JSON.stringify(archive) }).where('id', '=', row.owner_id).execute()
      await trx.insertInto('window_owners').values({ id: newId('wo'), region: row.region, num: row.num, owner_id: row.owner_id, transferred_at: at, type: 'released' }).execute()
      await trx.deleteFrom('window_follows').where('region', '=', row.region).where('num', '=', row.num).execute()
    })
  }
  return rows.length
}

/** Releases expired trial windows every 10 minutes. */
export function startTrialSweep(ctx: AppContext) {
  const run = () => expireTrials(ctx).catch((err) => console.error('[trial] sweep failed:', err))
  void run()
  setInterval(run, 10 * 60_000).unref()
}

// ---------------------------------------------------------------- resale

async function applyResale(
  db: DB,
  args: {
    buyer: Pick<UserRow, 'id' | 'name'>
    sellerId: string
    region: RegionId
    num: number
    price: number
    payment: CheckedPayment
    orderId?: string | null
    heldBy?: string
    rules: PlatformSettings['rules']
  },
) {
  const now = nowIso()
  const before = await db.selectFrom('windows').select(['code', 'title']).where('region', '=', args.region).where('num', '=', args.num).executeTakeFirstOrThrow()
  let update = db
    .updateTable('windows')
    .set({
      owner_id: args.buyer.id,
      owner_contact: null,
      external_link: null,
      profile_json: null,
      note_day: null,
      note_text: null,
      note_at: null,
      previous_owner_id: args.sellerId,
      status: 'occupied',
      resale_price: null,
      owner_changed_at: now,
      owner_change_kind: 'owner',
      last_purchase_price: args.price,
      last_image_updated_at: null,
      edit_day: null,
      edit_count: 0,
      reserved_order_id: null,
      welcomed_at: null,
      updated_at: now,
    })
    .where('region', '=', args.region)
    .where('num', '=', args.num)
    .where('owner_id', '=', args.sellerId)
    .where('status', '=', 'for_resale')
    .where('resale_price', '=', args.price)
  update = args.heldBy ? update.where('reserved_order_id', '=', args.heldBy) : update.where('reserved_order_id', 'is', null)
  const updated = await update.executeTakeFirst()
  if (Number(updated.numUpdatedRows) === 0) throw conflict('หน้าต่างบานนี้ไม่ได้เปิดขายต่อในราคานี้แล้ว')

  await db
    .insertInto('window_owners')
    .values({ id: newId('wo'), region: args.region, num: args.num, owner_id: args.sellerId, transferred_at: now, type: 'resale' })
    .execute()
  const commission = resaleCommission(args.price, args.rules)
  const sellerNet = args.price - commission
  await creditWallet(db, args.sellerId, sellerNet)
  const seller = await db.selectFrom('users').select('name').where('id', '=', args.sellerId).executeTakeFirst()
  await recordTransaction(db, {
    windowId: args.num,
    windowCode: before.code,
    region: args.region,
    windowTitle: before.title,
    fromOwner: seller?.name ?? 'ผู้ขาย',
    fromOwnerId: args.sellerId,
    toOwner: args.buyer.name,
    toOwnerId: args.buyer.id,
    amount: args.price,
    commissionRate: commissionRate(args.rules),
    commissionAmount: commission,
    netSellerAmount: sellerNet,
    type: 'resale',
    ...paymentFields(args.payment, args.orderId),
  })
}

/**
 * Buy a window listed for resale. The seller receives the price minus the commission (settings.rules) in their wallet; the commission is the
 * platform commission. `expectedPrice` guards against the seller changing the price meanwhile.
 */
export async function buyResale(
  ctx: AppContext,
  user: UserRow,
  region: RegionId,
  num: number,
  expectedPrice: number,
  paymentInput: PaymentInput,
): Promise<PurchaseResult> {
  assertCanTrade(user)
  const row = await ctx.db.selectFrom('windows').selectAll().where('region', '=', region).where('num', '=', num).executeTakeFirst()
  if (row?.suspended_at) throw forbidden('หน้าต่างนี้ถูกระงับชั่วคราว อยู่ระหว่างรอการตรวจสอบจากทีมงาน')
  if (!row) throw notFound('ไม่พบหน้าต่าง')
  if (row.status !== 'for_resale' || !row.resale_price || !row.owner_id) throw badRequest('หน้าต่างบานนี้ไม่ได้เปิดขายต่อในขณะนี้')
  if (row.owner_id === user.id) throw badRequest('คุณเป็นเจ้าของหน้าต่างบานนี้อยู่แล้ว')
  if (row.reserved_order_id) throw conflict('มีผู้ซื้อรายอื่นกำลังชำระเงินสำหรับบานนี้อยู่')
  if (expectedPrice !== row.resale_price) throw conflict(`ราคาขายเปลี่ยนเป็น ฿${row.resale_price.toLocaleString()} แล้ว กรุณาตรวจสอบอีกครั้ง`)

  const price = row.resale_price
  const sellerId = row.owner_id
  const payment = await checkPayment(ctx, price, paymentInput)
  const orderId = payment.externalAmount > 0 ? newId('ord') : null
  const { rules } = await getSettings(ctx)
  await ctx.db.transaction().execute(async (trx) => {
    await lockUser(trx, user.id)
    await assertQuota(trx, user.id, region)
    await debitWallet(trx, user.id, payment.walletAmount)
    const label = `ซื้อต่อบาน ${row.code}`
    if (payment.viaSlip) {
      const held = await trx
        .updateTable('windows')
        .set({ reserved_order_id: orderId })
        .where('region', '=', region)
        .where('num', '=', num)
        .where('status', '=', 'for_resale')
        .where('owner_id', '=', sellerId)
        .where('resale_price', '=', price)
        .where('reserved_order_id', 'is', null)
        .executeTakeFirst()
      if (Number(held.numUpdatedRows) === 0) throw conflict('หน้าต่างบานนี้ไม่ได้เปิดขายต่อในราคานี้แล้ว')
      await insertOrder(trx, { id: orderId!, user, kind: 'resale', label, amount: price, payment, status: 'pending', payload: { sellerId }, region, num })
      return
    }
    if (orderId) await insertOrder(trx, { id: orderId, user, kind: 'resale', label, amount: price, payment, status: 'approved', region, num })
    await applyResale(trx, { buyer: user, sellerId, region, num, price, payment, orderId, rules })
  })
  return result(ctx, user.id, payment.viaSlip, orderId)
}

// ---------------------------------------------------------------- top-up

export async function topUp(
  ctx: AppContext,
  user: UserRow,
  amount: number,
  input: { channelId?: string; slip?: PaymentInput['slip'] },
): Promise<PurchaseResult> {
  if (user.role === 'admin') throw forbidden('บัญชีผู้ดูแลระบบเติมเงินเข้ากระเป๋าไม่ได้')
  if (user.suspended) throw forbidden('บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน')
  const { min, max } = (await getSettings(ctx)).topUp
  if (!Number.isInteger(amount) || amount < min) throw badRequest(`เติมขั้นต่ำ ฿${min.toLocaleString()}`)
  if (amount > max) throw badRequest(`เติมได้สูงสุดครั้งละ ฿${max.toLocaleString()}`)
  const payment = await checkPayment(ctx, amount, { walletAmount: 0, externalAmount: amount, channelId: input?.channelId, slip: input?.slip })

  const orderId = newId('ord')
  const label = 'เติมเงินเข้ากระเป๋า'
  await ctx.db.transaction().execute(async (trx) => {
    await insertOrder(trx, { id: orderId, user, kind: 'topup', label, amount, payment, status: payment.viaSlip ? 'pending' : 'approved' })
    if (!payment.viaSlip) await completeTopUp(trx, { userId: user.id, userName: user.name, amount, payment, orderId })
  })
  return result(ctx, user.id, payment.viaSlip, orderId)
}

async function completeTopUp(db: DB, args: { userId: string; userName: string; amount: number; payment: CheckedPayment; orderId: string }) {
  await creditWallet(db, args.userId, args.amount)
  await recordTransaction(db, {
    windowId: 0,
    windowCode: 'TOP-UP',
    region: 'thailand',
    windowTitle: `เติมเงินเข้ากระเป๋าผ่าน ${args.payment.channel?.name ?? ''}`,
    fromOwner: args.payment.channel?.name ?? 'ช่องทางชำระเงิน',
    toOwner: args.userName,
    toOwnerId: args.userId,
    amount: args.amount,
    type: 'topup',
    ...paymentFields(args.payment, args.orderId),
  })
}

// ---------------------------------------------------------------- promo payment

export async function payForPromo(
  db: DB,
  ctx: AppContext,
  args: { user: UserRow; requestId: string; brand: string; size: number; rounds: number; price: number; paymentInput: PaymentInput },
) {
  const payment = await checkPayment(ctx, args.price, args.paymentInput)
  const orderId = payment.externalAmount > 0 ? newId('ord') : null
  await debitWallet(db, args.user.id, payment.walletAmount)
  if (orderId) {
    await insertOrder(db, {
      id: orderId,
      user: args.user,
      kind: 'promo',
      label: `ค่าโปรโมท "${args.brand}"`,
      amount: args.price,
      payment,
      status: payment.viaSlip ? 'pending' : 'approved',
      promoRequestId: args.requestId,
    })
  }
  const transactionId = payment.viaSlip ? undefined : await recordPromoPayment(db, args.user, args, payment, orderId)
  return {
    amount: args.price,
    walletAmount: payment.walletAmount,
    externalAmount: payment.externalAmount,
    channelName: payment.externalAmount > 0 ? payment.channel?.name : undefined,
    slipRef: payment.slipRef,
    paidAt: nowIso(),
    transactionId,
    orderId: orderId ?? undefined,
    orderStatus: payment.viaSlip ? ('pending' as const) : ('approved' as const),
  }
}

function recordPromoPayment(
  db: DB,
  user: Pick<UserRow, 'id' | 'name'>,
  promo: { brand: string; size: number; rounds: number; price: number },
  payment: CheckedPayment,
  orderId: string | null,
) {
  return recordTransaction(db, {
    windowId: 0,
    windowCode: 'PROMO',
    region: 'thailand',
    windowTitle: `ค่าโปรโมท "${promo.brand}" ${promo.size} บาน · ${promo.rounds} รอบ`,
    fromOwner: user.name,
    fromOwnerId: user.id,
    toOwner: 'พื้นที่โปรโมท 500 Windows',
    toOwnerId: 'platform',
    amount: promo.price,
    type: 'promo',
    ...paymentFields(payment, orderId),
  })
}

// ---------------------------------------------------------------- admin: slip review

const checkedFromOrder = (order: OrderRow): CheckedPayment => ({
  walletAmount: order.wallet_amount,
  externalAmount: order.external_amount,
  channel: order.channel_id ? ({ id: order.channel_id, name: order.channel_name ?? '' } as PaymentChannel) : undefined,
  viaSlip: true,
  slipUrl: order.slip_url ?? undefined,
  slipRef: order.slip_ref ?? undefined,
})

/** Approve or reject a pending transfer. Approving completes the purchase / top-up. */
export async function decideOrder(ctx: AppContext, admin: UserRow, orderId: string, decision: 'approved' | 'rejected', note = '') {
  const reason = String(note ?? '').trim().slice(0, 500)
  if (decision === 'rejected' && !reason) throw badRequest('กรุณาระบุเหตุผลที่ไม่อนุมัติ')
  const { rules } = await getSettings(ctx)
  await ctx.db.transaction().execute(async (trx) => {
    const order = await trx.selectFrom('payment_orders').selectAll().where('id', '=', orderId).executeTakeFirst()
    if (!order) throw notFound('ไม่พบรายการชำระเงิน')
    const marked = await trx
      .updateTable('payment_orders')
      .set({ status: decision, decided_at: nowIso(), decided_by: admin.id, note: reason || null })
      .where('id', '=', orderId)
      .where('status', '=', 'pending')
      .executeTakeFirst()
    if (Number(marked.numUpdatedRows) === 0) throw conflict('รายการนี้ถูกพิจารณาไปแล้ว')
    const buyer = await trx.selectFrom('users').select(['id', 'name']).where('id', '=', order.user_id).executeTakeFirstOrThrow()
    const payment = checkedFromOrder(order)
    const region = order.region as RegionId

    if (decision === 'approved') {
      if (order.kind === 'topup') {
        await completeTopUp(trx, { userId: buyer.id, userName: buyer.name, amount: order.amount, payment, orderId })
      } else if (order.kind === 'claim') {
        const content = JSON.parse(order.payload_json || '{}') as ClaimPayload
        if ((content as { trial?: boolean }).trial) await applyTrialPayment(trx, { buyer, region, num: order.window_num!, price: order.amount, payment, orderId, heldBy: orderId })
        else         await applyClaim(trx, { buyer, region, num: order.window_num!, price: order.amount, content, payment, orderId, heldBy: orderId })
      } else if (order.kind === 'resale') {
        const { sellerId } = JSON.parse(order.payload_json || '{}') as { sellerId: string }
        await applyResale(trx, { buyer, sellerId, region, num: order.window_num!, price: order.amount, payment, orderId, heldBy: orderId, rules })
      } else if (order.kind === 'promo' && order.promo_request_id) {
        const request = await trx.selectFrom('promo_requests').selectAll().where('id', '=', order.promo_request_id).executeTakeFirstOrThrow()
        const transactionId = await recordPromoPayment(trx, buyer, request, payment, orderId)
        const paid = { ...JSON.parse(request.payment_json || '{}'), orderStatus: 'approved', transactionId }
        await trx.updateTable('promo_requests').set({ payment_json: JSON.stringify(paid) }).where('id', '=', request.id).execute()
      }
    } else {
      await refundWalletPart(trx, order, buyer, reason)
      await trx.updateTable('windows').set({ reserved_order_id: null }).where('reserved_order_id', '=', orderId).execute()
      if (order.kind === 'promo' && order.promo_request_id) {
        const request = await trx.selectFrom('promo_requests').selectAll().where('id', '=', order.promo_request_id).executeTakeFirstOrThrow()
        const paid = { ...JSON.parse(request.payment_json || '{}'), orderStatus: 'rejected' }
        await trx
          .updateTable('promo_requests')
          .set({ status: 'rejected', payment_json: JSON.stringify(paid), decided_at: nowIso(), decided_by: admin.id, decision_note: `สลิปไม่ผ่านการตรวจสอบ: ${reason}` })
          .where('id', '=', request.id)
          .where('status', '=', 'pending')
          .execute()
      }
    }
    await audit(
      trx,
      admin,
      decision === 'approved' ? 'อนุมัติสลิปชำระเงิน' : 'ไม่อนุมัติสลิปชำระเงิน',
      `${order.label} · ${buyer.name} · ฿${order.external_amount.toLocaleString()} (${order.channel_name ?? '-'})${reason ? ` · ${reason}` : ''}`,
    )
  })
}

/** Returns the wallet part of a rejected order to the payer. */
async function refundWalletPart(db: DB, order: OrderRow, buyer: { id: string; name: string }, reason: string) {
  if (order.wallet_amount <= 0) return
  await creditWallet(db, buyer.id, order.wallet_amount)
  await recordTransaction(db, {
    windowId: order.window_num ?? 0,
    windowCode: 'REFUND',
    region: (order.region as RegionId) ?? 'thailand',
    windowTitle: `คืนเงินส่วนที่ชำระจากกระเป๋า: ${order.label} (สลิปไม่ผ่าน: ${reason})`,
    fromOwner: '500 Windows',
    fromOwnerId: 'platform',
    toOwner: buyer.name,
    toOwnerId: buyer.id,
    amount: order.wallet_amount,
    type: 'refund',
    walletAmount: order.wallet_amount,
    externalAmount: 0,
    orderId: order.id,
  })
}

export async function userOrders(ctx: AppContext, userId: string, limit = 50): Promise<PaymentOrder[]> {
  const rows = await ctx.db.selectFrom('payment_orders').selectAll().where('user_id', '=', userId).orderBy('created_at', 'desc').limit(limit).execute()
  return rows.map((r) => toOrder(r))
}


/** One order with its payer's name (for alerts). */
export async function findOrder(ctx: AppContext, orderId: string): Promise<PaymentOrder | undefined> {
  const row = await ctx.db
    .selectFrom('payment_orders')
    .leftJoin('users', 'users.id', 'payment_orders.user_id')
    .selectAll('payment_orders')
    .select('users.name as user_name')
    .where('payment_orders.id', '=', orderId)
    .executeTakeFirst()
  return row ? toOrder(row, row.user_name ?? '') : undefined
}
