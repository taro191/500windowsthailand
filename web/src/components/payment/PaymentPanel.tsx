// Shared "how do you want to pay" step: wallet first, the remainder through one of the
// platform's channels. Used by checkout (windows) and the promo request dialog.
import { useMemo, useState } from 'react'
import { ArrowRight, CircleAlert, Wallet } from 'lucide-react'
import type { PaymentBreakdown, PaymentSlip, User } from '@/types'
import { DEMO_MODE, suggestPaymentSplit } from '@/lib/store'
import { enabledChannels, useSettings } from '@/lib/settings'
import { ChannelPicker } from './ChannelPicker'
import { ExternalPaymentFlow } from './ExternalPaymentFlow'

export type ConfirmResult = { success: true } | { success: false; error: string }

interface PaymentPanelProps {
  payer: User
  amount: number
  /** What is being paid for, e.g. "หน้าต่างบานที่ KAP-TH-040". */
  itemLabel: string
  /** Short reference printed on the demo slip. */
  reference: string
  /** Performs the purchase with the collected payment. */
  onConfirm: (payment: PaymentBreakdown) => ConfirmResult
  /** Called after a successful onConfirm. */
  onPaid: (payment: PaymentBreakdown) => void
  onOpenTopUp?: () => void
  onCancel?: () => void
}

export function PaymentPanel({ payer, amount, itemLabel, reference, onConfirm, onPaid, onOpenTopUp, onCancel }: PaymentPanelProps) {
  const settings = useSettings()
  const channels = enabledChannels(settings)
  const [step, setStep] = useState<'method' | 'external'>('method')
  const [useWallet, setUseWallet] = useState(true)
  const [channelId, setChannelId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const balance = payer.balance
  const split = useMemo(() => suggestPaymentSplit(balance, amount, useWallet), [balance, amount, useWallet])
  const channel = channels.find((c) => c.id === channelId) || null
  const needsExternal = split.externalAmount > 0

  const complete = (slip?: PaymentSlip) => {
    const payment: PaymentBreakdown = {
      walletAmount: split.walletAmount,
      externalAmount: split.externalAmount,
      channelId: needsExternal ? channel?.id : undefined,
      channelName: needsExternal ? channel?.name : undefined,
      slip,
    }
    const outcome = onConfirm(payment)
    if (outcome.success) {
      onPaid(payment)
    } else {
      setError(outcome.error)
      setStep('method')
    }
  }

  const proceed = () => {
    setError('')
    if (!needsExternal) return complete()
    if (!channel) return setError('กรุณาเลือกช่องทางชำระเงินสำหรับยอดที่เหลือ')
    setStep('external')
  }

  if (step === 'external' && channel) {
    return (
      <ExternalPaymentFlow
        channel={channel}
        amount={split.externalAmount}
        payerName={payer.name}
        reference={reference}
        onBack={() => setStep('method')}
        onApproved={complete}
      />
    )
  }

  return (
    <div className="space-y-4 text-xs text-stone-200">
      {DEMO_MODE && (
        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
          <span>🧪</span>
          <span>
            <strong>โหมดสาธิต:</strong> QR, การตรวจสลิป และ Payment Gateway เป็นการจำลอง กรุณาอย่าโอนเงินจริง
          </span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 flex items-center gap-2">
          <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#171129] to-[#0d0917] border border-purple-500/30 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] text-purple-300 uppercase tracking-wider block font-bold">ยอดที่ต้องชำระ</span>
          <span className="text-sm font-bold text-stone-100 block truncate">{itemLabel}</span>
          <span className="text-[11px] text-stone-400">ผู้ชำระ: {payer.name}</span>
        </div>
        <span className="text-xl font-bold font-mono text-rose-300 shrink-0">฿{amount.toLocaleString()}</span>
      </div>

      <div className="p-3.5 rounded-xl bg-[#09080e] border border-purple-900/40 space-y-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="flex items-center gap-2 text-stone-200 font-semibold">
            <Wallet className="w-4 h-4 text-amber-400" />
            ชำระจากกระเป๋าเงิน
            <span className="text-[11px] font-mono text-stone-400 font-normal">(คงเหลือ ฿{balance.toLocaleString()})</span>
          </span>
          <input
            type="checkbox"
            checked={useWallet}
            onChange={(e) => setUseWallet(e.target.checked)}
            disabled={balance <= 0}
            className="w-4 h-4 accent-rose-500"
          />
        </label>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between text-stone-400">
            <span>ตัดจากกระเป๋าเงิน</span>
            <span className="text-amber-300 font-bold">฿{split.walletAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-stone-400">
            <span>ชำระผ่านช่องทางอื่น</span>
            <span className="text-rose-300 font-bold">฿{split.externalAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-purple-900/30 text-stone-300">
            <span>คงเหลือในกระเป๋าหลังชำระ</span>
            <span>฿{(balance - split.walletAmount).toLocaleString()}</span>
          </div>
        </div>
        {useWallet && needsExternal && balance > 0 && (
          <p className="text-[11px] text-amber-300/90 m-0">
            ยอดในกระเป๋าไม่พอ ระบบจะตัดกระเป๋า ฿{split.walletAmount.toLocaleString()} และให้ชำระส่วนที่เหลือผ่านช่องทางที่เลือก
          </p>
        )}
        {onOpenTopUp && (
          <button type="button" onClick={onOpenTopUp} className="text-[11px] text-amber-400 hover:underline cursor-pointer">
            + เติมเงินเข้ากระเป๋าก่อน
          </button>
        )}
      </div>

      {needsExternal && (
        <div className="space-y-2">
          <span className="text-stone-300 font-semibold block">
            เลือกช่องทางชำระส่วนที่เหลือ <span className="font-mono text-rose-300">฿{split.externalAmount.toLocaleString()}</span>
          </span>
          <ChannelPicker channels={channels} selectedId={channelId} onSelect={setChannelId} />
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 rounded-xl bg-[#140f22] hover:bg-[#1a142c] border border-purple-900/30 text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer"
          >
            ย้อนกลับ
          </button>
        )}
        <button
          type="button"
          onClick={proceed}
          disabled={needsExternal && !channel}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${needsExternal && !channel ? 'bg-stone-800 text-stone-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white hover:opacity-95 shadow-lg shadow-rose-500/20 cursor-pointer'}`}
        >
          <span>
            {needsExternal
              ? `ไปชำระ ฿${split.externalAmount.toLocaleString()} ผ่าน${channel ? channel.name : 'ช่องทางที่เลือก'}`
              : `ยืนยันชำระจากกระเป๋า ฿${amount.toLocaleString()}`}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
