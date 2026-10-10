import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Clock, History, Loader2, Wallet, X, XCircle } from 'lucide-react'
import type { PaymentOrder, Transaction, User } from '@shared/types'
import { loadOrders, loadTransactions, refreshSession } from '@/lib/store'
import { RESALE_COMMISSION_RATE } from '@/lib/ownershipRules'

interface WalletHistoryModalProps {
  currentUser: User
  onClose: () => void
  /** Called after the history reloads, so the app can pick up a changed balance. */
  onRefreshed: () => void
}

type Filter = 'all' | 'in' | 'out' | 'pending'

interface Entry {
  id: string
  date: string
  title: string
  detail?: string
  /** Change to the wallet balance; 0 when the money went through another channel only. */
  walletChange: number
  /** Paid outside the wallet (bank transfer, PromptPay, card). */
  external?: { amount: number; channel?: string }
  status?: 'pending' | 'rejected'
  /** A top-up slip: money that comes into the wallet once an admin approves it. */
  incoming?: number
  note?: string
}

const TYPE_TITLES: Record<string, string> = {
  claim: 'จับจองหน้าต่าง',
  resale: 'ซื้อหน้าต่างต่อ',
  transfer: 'โอนสิทธิ์หน้าต่าง',
  topup: 'เติมเงินเข้ากระเป๋า',
  promo: 'ค่าโปรโมท',
  refund: 'คืนเงินเข้ากระเป๋า',
  edit_fee: 'ค่าแก้ไขบาน',
  bonus: 'โบนัสสมัครสมาชิก',
}

const ORDER_TITLES: Record<string, string> = {
  topup: 'เติมเงินเข้ากระเป๋า',
  claim: 'จับจองหน้าต่าง',
  resale: 'ซื้อหน้าต่างต่อ',
  promo: 'ค่าโปรโมท',
}

/** How one transaction changed this user's wallet. */
function fromTransaction(tx: Transaction, userId: string): Entry {
  const base = { id: tx.id, date: tx.date, detail: tx.windowId ? `${tx.windowCode} · ${tx.windowTitle}` : tx.windowTitle }
  const external = tx.externalAmount ? { amount: tx.externalAmount, channel: tx.channelName } : undefined
  // Money in: top-ups, bonuses, refunds, and the seller's share of a resale.
  if (tx.type === 'topup' || tx.type === 'bonus' || tx.type === 'refund') {
    return { ...base, title: TYPE_TITLES[tx.type], walletChange: tx.amount }
  }
  if (tx.type === 'resale' && tx.fromOwnerId === userId) {
    const net = tx.netSellerAmount ?? tx.amount - Math.round(tx.amount * RESALE_COMMISSION_RATE)
    return { ...base, title: 'ขายหน้าต่างต่อ (รับสุทธิหลังหักค่าคอมมิชชั่น)', walletChange: net }
  }
  // Money out: what the wallet paid; any external part is shown separately.
  const fromWallet = tx.walletAmount ?? (external ? 0 : tx.amount)
  return { ...base, title: TYPE_TITLES[tx.type] ?? tx.type, walletChange: -fromWallet, external }
}

/**
 * Slips still waiting for an admin, or rejected (approved ones already appear as transactions).
 * The wallet part is taken when the order is made; a rejection returns it as a separate refund.
 */
function fromOrder(order: PaymentOrder): Entry {
  return {
    id: order.id,
    date: order.createdAt,
    title: ORDER_TITLES[order.kind] ?? order.label,
    detail: order.label !== ORDER_TITLES[order.kind] ? order.label : undefined,
    walletChange: -order.walletAmount,
    incoming: order.kind === 'topup' ? order.amount : undefined,
    external: order.externalAmount ? { amount: order.externalAmount, channel: order.channelName } : undefined,
    status: order.status === 'pending' ? 'pending' : 'rejected',
    note:
      order.status === 'pending'
        ? order.walletAmount > 0
          ? 'ส่วนที่หักจากกระเป๋าจะคืนให้ ถ้าสลิปไม่ผ่านการอนุมัติ'
          : undefined
        : [order.note && `เหตุผล: ${order.note}`, order.walletAmount > 0 && 'คืนเงินส่วนที่หักจากกระเป๋าแล้ว (ดูรายการคืนเงิน)']
            .filter(Boolean)
            .join(' · ') || undefined,
  }
}

const baht = (n: number) => `฿${Math.abs(n).toLocaleString()}`
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'in', label: 'เงินเข้า' },
  { id: 'out', label: 'เงินออก' },
  { id: 'pending', label: 'รอตรวจ / ไม่อนุมัติ' },
]

/** The signed-in user's own wallet statement: every top-up, charge, sale and refund. */
export function WalletHistoryModal({ currentUser, onClose, onRefreshed }: WalletHistoryModalProps) {
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [entries, setEntries] = useState<Entry[]>([])

  useEffect(() => {
    let cancelled = false
    const build = () =>
      [
        ...loadTransactions().map((tx) => fromTransaction(tx, currentUser.id)),
        ...loadOrders()
          .filter((o) => o.status !== 'approved')
          .map(fromOrder),
      ].sort((a, b) => b.date.localeCompare(a.date))
    setEntries(build())
    refreshSession().then(() => {
      if (cancelled) return
      setEntries(build())
      setLoading(false)
      onRefreshed()
    })
    return () => {
      cancelled = true
    }
  }, [currentUser.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalIn = entries.reduce((sum, e) => sum + Math.max(e.walletChange, 0), 0)
  const totalOut = entries.reduce((sum, e) => sum + Math.max(-e.walletChange, 0), 0)
  const shown = entries.filter(
    (e) =>
      filter === 'all' ||
      (filter === 'pending' && !!e.status) ||
      (filter === 'in' && (e.walletChange > 0 || !!e.incoming)) ||
      (filter === 'out' && (e.walletChange < 0 || (!!e.external && !e.incoming))),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 font-['Plus_Jakarta_Sans','Prompt',sans-serif]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0e0b17] border border-purple-900/40 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="font-bold text-stone-100 text-base font-['Prompt',sans-serif]">ประวัติการเงิน</h2>
              <p className="text-xs text-stone-400 font-['Prompt',sans-serif]">การเติมเงิน การตัดเงิน และเงินเข้ากระเป๋าของคุณ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4 space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-stone-950 border border-amber-500/40">
              <span className="flex items-center gap-1 text-[10px] text-stone-400">
                <Wallet className="w-3 h-3" /> คงเหลือ
              </span>
              <span className="font-mono font-bold text-amber-300 text-sm">{baht(currentUser.balance)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-stone-950 border border-emerald-500/30">
              <span className="text-[10px] text-stone-400 block">เงินเข้ารวม</span>
              <span className="font-mono font-bold text-emerald-300 text-sm">+{baht(totalIn)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-stone-950 border border-rose-500/30">
              <span className="text-[10px] text-stone-400 block">ตัดจากกระเป๋ารวม</span>
              <span className="font-mono font-bold text-rose-300 text-sm">−{baht(totalOut)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${filter === f.id ? 'bg-amber-400 text-stone-950 border-amber-400' : 'bg-stone-950 text-stone-300 border-stone-700 hover:border-stone-500'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 pt-3 overflow-y-auto flex-1 space-y-2 text-xs">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-stone-400">
              <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...
            </div>
          ) : shown.length === 0 ? (
            <p className="text-stone-500 italic p-3 bg-stone-950 rounded-lg border border-stone-800 text-center">ยังไม่มีรายการ</p>
          ) : (
            shown.map((e) => <EntryRow key={e.id} entry={e} />)
          )}
          <p className="text-[10px] text-stone-500 pt-1">แสดง 200 รายการล่าสุด · สลิปที่อนุมัติแล้วจะแสดงเป็นรายการปกติ</p>
        </div>
      </div>
    </div>
  )
}

function EntryRow({ entry: e }: { entry: Entry }) {
  const incoming = e.walletChange > 0
  const Icon = e.status === 'pending' ? Clock : e.status === 'rejected' ? XCircle : incoming ? ArrowDownLeft : ArrowUpRight
  const iconClass =
    e.status === 'pending'
      ? 'text-amber-300 bg-amber-950/60'
      : e.status === 'rejected'
        ? 'text-stone-400 bg-stone-800'
        : incoming
          ? 'text-emerald-300 bg-emerald-950/60'
          : 'text-rose-300 bg-rose-950/60'
  return (
    <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 flex gap-2.5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold text-stone-100">{e.title}</span>
          {e.walletChange !== 0 && (
            <span className={`font-mono font-bold whitespace-nowrap ${incoming ? 'text-emerald-300' : 'text-rose-300'}`}>
              {incoming ? '+' : '−'}
              {baht(e.walletChange)}
            </span>
          )}
          {!!e.incoming && (
            <span
              className={`font-mono font-bold whitespace-nowrap ${e.status === 'rejected' ? 'text-stone-500 line-through' : 'text-amber-300'}`}
            >
              +{baht(e.incoming)}
            </span>
          )}
        </div>
        {e.detail && <div className="text-[11px] text-stone-400 truncate">{e.detail}</div>}
        {e.external && (
          <div className="text-[11px] text-sky-300">
            {e.incoming ? 'โอนเข้ามาผ่าน' : 'ชำระผ่าน'} {e.external.channel || 'ช่องทางอื่น'} {baht(e.external.amount)}
          </div>
        )}
        {e.incoming && e.status === 'pending' && (
          <div className="text-[10px] text-amber-300/80">ยอดจะเข้ากระเป๋าเมื่อผู้ดูแลอนุมัติสลิป</div>
        )}
        {e.status && (
          <span
            className={`inline-block text-[10px] font-bold px-1.5 rounded ${e.status === 'pending' ? 'bg-amber-950 text-amber-300' : 'bg-stone-800 text-stone-300'}`}
          >
            {e.status === 'pending' ? 'รอผู้ดูแลตรวจสลิป' : 'ไม่อนุมัติ'}
          </span>
        )}
        {e.note && <div className="text-[10px] text-stone-400">{e.note}</div>}
        <div className="text-[10px] text-stone-500 font-mono">{dateTime(e.date)}</div>
      </div>
    </div>
  )
}
