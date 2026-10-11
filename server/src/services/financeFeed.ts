// LINE feed of every money movement (top-ups, claims, resales, promotions, edit fees, refunds, bonuses).
// Reads committed rows of the transactions table, so a purchase that rolled back is never reported,
// and moves a cursor kept in the settings table so that only one server process sends each batch.
import type { Transaction } from '@shared/types'
import { nowIso, type AppContext } from '../context'
import { toTransaction } from './ledger'
import { sendLineAlert } from './notify'

const CURSOR_ROW = 'finance_feed_cursor'
/** Rows younger than this are left for the next run, in case an older transaction commits late. */
const SETTLE_MS = 5_000
const BATCH = 30
const INTERVAL_MS = 30_000

interface Cursor {
  date: string
  id: string
}

const baht = (n: number) => `฿${n.toLocaleString()}`
const time = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })

/** How the payer paid: "กระเป๋า ฿200 + ธนาคารกสิกรไทย ฿300". */
function paidWith(tx: Transaction) {
  const parts = [
    tx.walletAmount ? `กระเป๋า ${baht(tx.walletAmount)}` : '',
    tx.externalAmount ? `${tx.channelName || 'ช่องทางอื่น'} ${baht(tx.externalAmount)}` : '',
  ].filter(Boolean)
  return parts.length ? ` (จ่ายด้วย ${parts.join(' + ')})` : ''
}

/** One line per transaction, saying who gained or paid what. */
export function describeTransaction(tx: Transaction): string {
  const at = time(tx.date)
  switch (tx.type) {
    case 'topup':
      return `🟢 เติมเงิน +${baht(tx.amount)} · ${tx.toOwner} · ผ่าน ${tx.channelName || tx.fromOwner} · ${at}`
    case 'bonus':
      return `🟢 โบนัสสมัครสมาชิก +${baht(tx.amount)} · ${tx.toOwner} · ${at}`
    case 'refund':
      return `🟢 คืนเงินเข้ากระเป๋า +${baht(tx.amount)} · ${tx.toOwner} · ${tx.windowTitle} · ${at}`
    case 'claim':
      return `🔴 จับจองบาน ${tx.windowCode} ${baht(tx.amount)} · ${tx.toOwner}${paidWith(tx)} · ${at}`
    case 'resale': {
      const commission = tx.commissionAmount ?? 0
      const net = tx.netSellerAmount ?? tx.amount - commission
      return `🔁 ขายต่อบาน ${tx.windowCode} ${baht(tx.amount)} · ผู้ซื้อ ${tx.toOwner}${paidWith(tx)} · ผู้ขาย ${tx.fromOwner} รับ +${baht(net)} · ค่าคอม ${baht(commission)} · ${at}`
    }
    case 'promo':
      return `🔴 ${tx.windowTitle} ${baht(tx.amount)} · ${tx.fromOwner}${paidWith(tx)} · ${at}`
    case 'edit_fee':
      return `🔴 ค่าแก้ไขบาน ${tx.windowCode} ${baht(tx.amount)} · ${tx.fromOwner}${paidWith(tx)} · ${at}`
    default:
      return `• ${tx.type} ${tx.windowCode} ${baht(tx.amount)} · ${tx.fromOwner} → ${tx.toOwner} · ${at}`
  }
}

async function readCursor(ctx: AppContext): Promise<{ raw: string; cursor: Cursor } | null> {
  const row = await ctx.db.selectFrom('settings').select('value_json').where('id', '=', CURSOR_ROW).executeTakeFirst()
  return row ? { raw: row.value_json, cursor: JSON.parse(row.value_json) as Cursor } : null
}

/**
 * Sends the money movements since the last run as one LINE message. Returns how many were sent.
 * The first run only sets the cursor to now, so past transactions are not replayed.
 */
export async function pushFinanceFeed(ctx: AppContext, now = Date.now()): Promise<number> {
  if (!ctx.config.line.token) return 0
  const saved = await readCursor(ctx)
  if (!saved) {
    const start: Cursor = { date: new Date(now).toISOString(), id: '' }
    await ctx.db.insertInto('settings').values({ id: CURSOR_ROW, value_json: JSON.stringify(start), updated_at: nowIso() }).execute()
    return 0
  }
  const { cursor } = saved
  const settled = new Date(now - SETTLE_MS).toISOString()
  const rows = await ctx.db
    .selectFrom('transactions')
    .selectAll()
    .where((eb) => eb.or([eb('date', '>', cursor.date), eb.and([eb('date', '=', cursor.date), eb('id', '>', cursor.id)])]))
    .where('date', '<=', settled)
    .orderBy('date')
    .orderBy('id')
    .limit(BATCH)
    .execute()
  if (!rows.length) return 0

  // Claim the batch: only the process whose update lands sends it.
  const last = rows[rows.length - 1]
  const next = JSON.stringify({ date: last.date, id: last.id } satisfies Cursor)
  const claimed = await ctx.db
    .updateTable('settings')
    .set({ value_json: next, updated_at: nowIso() })
    .where('id', '=', CURSOR_ROW)
    .where('value_json', '=', saved.raw)
    .executeTakeFirst()
  if (Number(claimed.numUpdatedRows) === 0) return 0

  const lines = rows.map((row) => describeTransaction(toTransaction(row)))
  const title = `💰 ความเคลื่อนไหวทางการเงิน ${rows.length} รายการ`
  await sendLineAlert(ctx, [title, ...lines].join('\n'))
  return rows.length
}

/** Runs the feed every 30 seconds while LINE is set up. */
export function startFinanceFeed(ctx: AppContext) {
  if (!ctx.config.line.token) return
  const timer = setInterval(() => {
    pushFinanceFeed(ctx).catch((err) => console.error('[line] finance feed failed:', err))
  }, INTERVAL_MS)
  timer.unref()
}
