// Window refunds the owner asked to receive by bank transfer (purchases.refundWindow with toBank).
// An admin transfers the money and marks it paid, or returns it to the user's wallet instead.
import type { PayoutAccount, RefundPayout, RegionId } from '@shared/types'
import type { RefundPayoutsTable, UserRow } from '../db/schema'
import { badRequest, conflict, notFound } from '../lib/errors'
import { nowIso, type AppContext } from '../context'
import { audit } from './audit'
import { creditWallet, recordTransaction } from './ledger'

function toPayout(row: RefundPayoutsTable): RefundPayout {
  const account = JSON.parse(row.account_json) as PayoutAccount
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    windowCode: row.window_code,
    windowTitle: row.window_title,
    amount: row.amount,
    account: { type: account.type, bankName: account.bankName, accountNumber: account.accountNumber, accountName: account.accountName },
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    decidedAt: row.decided_at ?? undefined,
    decidedBy: row.decided_by ?? undefined,
  }
}

/** The user's own requests, newest first. */
export async function myRefundPayouts(ctx: AppContext, userId: string) {
  const rows = await ctx.db.selectFrom('refund_payouts').selectAll().where('user_id', '=', userId).orderBy('created_at', 'desc').limit(50).execute()
  return rows.map(toPayout)
}

/** Admin list: pending first, then the latest decided ones. */
export async function listRefundPayouts(ctx: AppContext) {
  const rows = await ctx.db.selectFrom('refund_payouts').selectAll().orderBy('created_at', 'desc').limit(300).execute()
  return rows.map(toPayout).sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
}

/**
 * `paid`: the admin transferred the amount (note = transfer reference), recorded as a refund paid outside the wallet.
 * `returned`: the transfer can't be made (note = why), so the amount goes to the user's wallet.
 */
export async function decideRefundPayout(ctx: AppContext, admin: UserRow, id: string, decision: unknown, noteInput: unknown) {
  if (decision !== 'paid' && decision !== 'returned') throw badRequest('การตัดสินใจไม่ถูกต้อง')
  const note = String(noteInput ?? '').trim().slice(0, 500)
  if (!note) throw badRequest(decision === 'paid' ? 'กรุณาใส่เลขอ้างอิงการโอน' : 'กรุณาระบุเหตุผลที่คืนเข้ากระเป๋าเงินแทน')
  const row = await ctx.db.selectFrom('refund_payouts').selectAll().where('id', '=', id).executeTakeFirst()
  if (!row) throw notFound('ไม่พบคำขอนี้')
  const now = nowIso()
  await ctx.db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('refund_payouts')
      .set({ status: decision, note, decided_at: now, decided_by: admin.name })
      .where('id', '=', id)
      .where('status', '=', 'pending')
      .executeTakeFirst()
    if (Number(updated.numUpdatedRows) === 0) throw conflict('คำขอนี้ดำเนินการไปแล้ว')
    if (decision === 'returned') await creditWallet(trx, row.user_id, row.amount)
    await recordTransaction(trx, {
      windowId: row.num,
      windowCode: row.window_code,
      region: row.region as RegionId,
      windowTitle:
        decision === 'paid'
          ? `คืนเงินค่าจับจอง "${row.window_title}" โอนเข้าบัญชีแล้ว (อ้างอิง ${note})`
          : `คืนเงินค่าจับจอง "${row.window_title}" เข้ากระเป๋าเงิน (โอนเข้าบัญชีไม่ได้: ${note})`,
      fromOwner: '500 Windows Thailand',
      fromOwnerId: 'platform',
      toOwner: row.user_name,
      toOwnerId: row.user_id,
      amount: row.amount,
      type: 'refund',
      walletAmount: decision === 'returned' ? row.amount : 0,
      externalAmount: decision === 'paid' ? row.amount : 0,
      ...(decision === 'paid' ? { channelName: 'โอนเข้าบัญชีผู้ใช้' } : {}),
    })
  })
  await audit(
    ctx.db,
    admin,
    decision === 'paid' ? 'โอนเงินคืนเข้าบัญชีแล้ว' : 'คืนเงินเข้ากระเป๋าแทนการโอน',
    `${row.user_name} · ${row.window_code} · ฿${row.amount.toLocaleString()} · ${note}`,
  )
  return listRefundPayouts(ctx)
}
