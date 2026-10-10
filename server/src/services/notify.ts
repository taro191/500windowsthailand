// Alerts to the finance admin on LINE. Sending never blocks or fails the request that caused it.
import type { PaymentOrder } from '@shared/types'
import { pushLine } from '../lib/line'
import { nowIso, type AppContext } from '../context'

const KIND_LABELS: Record<PaymentOrder['kind'], string> = {
  topup: 'เติมเงินเข้ากระเป๋า',
  claim: 'จับจองหน้าต่าง',
  resale: 'ซื้อหน้าต่างต่อ',
  promo: 'ค่าโปรโมท',
}

/** Settings row holding the recipient IDs saved from the admin page (kept out of the public config). */
const RECIPIENTS_ROW = 'line_recipients'
/** A LINE user (U…), group (C…) or room (R…) ID. */
export const LINE_ID = /^[UCR][0-9a-f]{32}$/

/** Recipient IDs saved by the super admin. */
export async function savedLineRecipients(ctx: AppContext): Promise<string[]> {
  const row = await ctx.db.selectFrom('settings').select('value_json').where('id', '=', RECIPIENTS_ROW).executeTakeFirst()
  const ids = row ? (JSON.parse(row.value_json) as unknown) : []
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && LINE_ID.test(id)) : []
}

export async function saveLineRecipients(ctx: AppContext, ids: string[]) {
  const value_json = JSON.stringify(ids)
  const updated_at = nowIso()
  const updated = await ctx.db.updateTable('settings').set({ value_json, updated_at }).where('id', '=', RECIPIENTS_ROW).executeTakeFirst()
  if (Number(updated.numUpdatedRows) === 0) await ctx.db.insertInto('settings').values({ id: RECIPIENTS_ROW, value_json, updated_at }).execute()
}

/** Everyone who gets alerts: LINE_ADMIN_TO plus the IDs saved from the admin page. */
export async function lineRecipients(ctx: AppContext) {
  return [...new Set([...ctx.config.line.to, ...(await savedLineRecipients(ctx))])]
}

/** The last LINE failure, so a super admin can see why alerts don't arrive. */
let lastFailure: { at: string; error: string } | null = null
export const lineLastFailure = () => lastFailure

/** Sends a text to the finance admin(s); resolves with the failures (none when LINE isn't set up). */
export async function sendLineAlert(ctx: AppContext, text: string) {
  const to = ctx.config.line.token ? await lineRecipients(ctx) : []
  if (!to.length) return []
  const failures = await pushLine({ ...ctx.config.line, to }, text).catch((err) => [{ to: '*', error: String(err) }])
  if (failures.length) {
    lastFailure = { at: new Date().toISOString(), error: failures.map((f) => `${f.to}: ${f.error}`).join(' | ') }
    console.error('[line] alert not sent:', lastFailure.error)
  }
  return failures
}

export function slipAlertText(order: PaymentOrder, siteUrl: string) {
  const baht = (n: number) => `฿${n.toLocaleString()}`
  return [
    '🧾 มีสลิปรอตรวจ',
    `${KIND_LABELS[order.kind] ?? order.kind}: ${order.label}`,
    `ผู้ใช้: ${order.userName || order.userId}`,
    `ยอดโอน: ${baht(order.externalAmount)}${order.channelName ? ` (${order.channelName})` : ''}`,
    order.walletAmount > 0 ? `หักจากกระเป๋า: ${baht(order.walletAmount)}` : '',
    `ยอดรวม: ${baht(order.amount)}`,
    `เวลา: ${new Date(order.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
    siteUrl ? `ตรวจสลิป: ${siteUrl}/#admin/payments` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Fire-and-forget alert for a slip that now waits for an admin. */
export function notifyPendingSlip(ctx: AppContext, order: PaymentOrder | undefined, siteUrl: string) {
  if (!order || order.status !== 'pending' || !ctx.config.line.token) return
  void sendLineAlert(ctx, slipAlertText(order, siteUrl)).catch((err) => console.error('[line] alert failed:', err))
}
