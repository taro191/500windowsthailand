// Wallet balance changes and the transaction history shown in the wallet and admin pages.
import type { RegionId, Transaction } from '@shared/types'
import type { DB } from '../db'
import type { TransactionRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest } from '../lib/errors'
import { nowIso } from '../context'

/** Takes `amount` from a wallet only if the balance covers it (atomic). */
export async function debitWallet(db: DB, userId: string, amount: number) {
  if (amount <= 0) return
  const result = await db
    .updateTable('users')
    .set((eb) => ({ balance: eb('balance', '-', amount) }))
    .where('id', '=', userId)
    .where('balance', '>=', amount)
    .executeTakeFirst()
  if (Number(result.numUpdatedRows) === 0) {
    const row = await db.selectFrom('users').select('balance').where('id', '=', userId).executeTakeFirst()
    throw badRequest(
      `ยอดเงินในกระเป๋าไม่เพียงพอ (ต้องการ ${amount.toLocaleString()} ฿ แต่คุณมี ${(row?.balance ?? 0).toLocaleString()} ฿)`,
    )
  }
}

export async function creditWallet(db: DB, userId: string, amount: number) {
  if (amount <= 0) return
  await db
    .updateTable('users')
    .set((eb) => ({ balance: eb('balance', '+', amount) }))
    .where('id', '=', userId)
    .execute()
}

export type NewTransaction = Omit<Transaction, 'id' | 'date'>

export async function recordTransaction(db: DB, entry: NewTransaction): Promise<string> {
  const id = newId('tx')
  await db
    .insertInto('transactions')
    .values({
      id,
      date: nowIso(),
      type: entry.type,
      region: entry.region,
      window_num: entry.windowId,
      window_code: entry.windowCode,
      window_title: entry.windowTitle.slice(0, 255),
      from_owner: entry.fromOwner.slice(0, 200),
      from_owner_id: entry.fromOwnerId ?? null,
      to_owner: entry.toOwner.slice(0, 200),
      to_owner_id: entry.toOwnerId,
      amount: entry.amount,
      commission_rate: entry.commissionRate ?? null,
      commission_amount: entry.commissionAmount ?? null,
      net_seller_amount: entry.netSellerAmount ?? null,
      wallet_amount: entry.walletAmount ?? null,
      external_amount: entry.externalAmount ?? null,
      channel_name: entry.channelName ?? null,
      slip_ref: entry.slipRef ?? null,
      order_id: entry.orderId ?? null,
    })
    .execute()
  return id
}

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    region: row.region as RegionId,
    windowId: row.window_num,
    windowCode: row.window_code,
    windowTitle: row.window_title,
    fromOwner: row.from_owner,
    fromOwnerId: row.from_owner_id ?? undefined,
    toOwner: row.to_owner,
    toOwnerId: row.to_owner_id,
    amount: row.amount,
    commissionRate: row.commission_rate ?? undefined,
    commissionAmount: row.commission_amount ?? undefined,
    netSellerAmount: row.net_seller_amount ?? undefined,
    walletAmount: row.wallet_amount ?? undefined,
    externalAmount: row.external_amount ?? undefined,
    channelName: row.channel_name ?? undefined,
    slipRef: row.slip_ref ?? undefined,
    slipStatus: row.slip_ref ? 'approved' : undefined,
    orderId: row.order_id ?? undefined,
  }
}

/** The user's transactions (as payer, receiver or seller), newest first. */
export async function userTransactions(db: DB, userId: string, limit = 200) {
  const rows = await db
    .selectFrom('transactions')
    .selectAll()
    .where((eb) => eb.or([eb('to_owner_id', '=', userId), eb('from_owner_id', '=', userId)]))
    .orderBy('date', 'desc')
    .limit(limit)
    .execute()
  return rows.map(toTransaction)
}
