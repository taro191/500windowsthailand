// Alerts to the finance admin on LINE. Sending never blocks or fails the request that caused it.
import type { PaymentOrder } from '@shared/types'
import { lineReady, pushLine } from '../lib/line'
import type { AppContext } from '../context'

const KIND_LABELS: Record<PaymentOrder['kind'], string> = {
  topup: 'เติมเงินเข้ากระเป๋า',
  claim: 'จับจองหน้าต่าง',
  resale: 'ซื้อหน้าต่างต่อ',
  promo: 'ค่าโปรโมท',
}

/** The last LINE failure, so a super admin can see why alerts don't arrive. */
let lastFailure: { at: string; error: string } | null = null
export const lineLastFailure = () => lastFailure

/** Sends a text to the finance admin(s); resolves with the failures (none when LINE isn't set up). */
export async function sendLineAlert(ctx: AppContext, text: string) {
  if (!lineReady(ctx.config.line)) return []
  const failures = await pushLine(ctx.config.line, text).catch((err) => [{ to: '*', error: String(err) }])
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
  if (!order || order.status !== 'pending' || !lineReady(ctx.config.line)) return
  void sendLineAlert(ctx, slipAlertText(order, siteUrl))
}
