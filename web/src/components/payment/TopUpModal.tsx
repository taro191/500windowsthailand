import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleAlert, Clock, Loader2, Wallet, X } from 'lucide-react'
import type { PaymentChannel, PaymentSlip, User } from '@shared/types'
import { isDemo, paymentChannels } from '@/lib/store'
import { useSettings } from '@/lib/settings'
import { KapsulepLogo } from '../KapsulepLogo'
import { ChannelPicker } from './ChannelPicker'
import { ExternalPaymentFlow } from './ExternalPaymentFlow'

type Step = 'amount' | 'pay' | 'done'

interface TopUpModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: User | null
  /** Card: credited at once. Transfer: the slip waits for an admin (`pending`). */
  onTopUp: (amount: number, channel: PaymentChannel, slip: PaymentSlip) => Promise<{ success: true; pending: boolean } | { success: false; error: string }>
}

/** Add money to the wallet through one of the platform's receiving channels. */
export function TopUpModal({ isOpen, onClose, currentUser, onTopUp }: TopUpModalProps) {
  const settings = useSettings()
  const { min, max, presets } = settings.topUp
  const channels = paymentChannels(settings)
  const [step, setStep] = useState<Step>('amount')
  const [amountInput, setAmountInput] = useState(String(presets[1] ?? presets[0] ?? min))
  const [channelId, setChannelId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [credited, setCredited] = useState(0)
  const [pending, setPending] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setStep('amount')
    setChannelId(null)
    setError('')
  }, [isOpen])

  if (!isOpen || !currentUser) return null

  const amount = Math.floor(Number(amountInput) || 0)
  const channel = channels.find((c) => c.id === channelId) || null
  const amountError =
    amount < min ? `เติมขั้นต่ำ ฿${min.toLocaleString()}` : amount > max ? `เติมได้สูงสุดครั้งละ ฿${max.toLocaleString()}` : ''

  const next = () => {
    if (amountError) return setError(amountError)
    if (!channel) return setError('กรุณาเลือกช่องทางชำระเงิน')
    setError('')
    setStep('pay')
  }

  const approved = async (slip: PaymentSlip) => {
    if (!channel) return
    setBusy(true)
    const result = await onTopUp(amount, channel, slip)
    setBusy(false)
    if (result.success) {
      setCredited(amount)
      setPending(result.pending)
      setStep('done')
    } else {
      setError(result.error)
      setStep('amount')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="relative w-full max-w-lg bg-[#110e1a] border border-purple-900/50 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-2.5">
            <KapsulepLogo size={26} showGlow />
            <div>
              <span className="font-bold text-stone-100 text-sm sm:text-base block leading-tight">เติมเงินเข้ากระเป๋า</span>
              <span className="text-[11px] text-stone-400">ยอดคงเหลือปัจจุบัน ฿{currentUser.balance.toLocaleString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {isDemo() && step !== 'done' && (
            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200 flex items-start gap-2">
              <span>🧪</span>
              <span>
                <strong>ระบบทดสอบ:</strong> QR และการชำระด้วยบัตรเป็นการจำลอง กรุณาอย่าโอนเงินจริง
              </span>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 flex items-center gap-2">
              <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'amount' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-stone-300 font-semibold block">จำนวนเงินที่ต้องการเติม</span>
                <div className="grid grid-cols-4 gap-2">
                  {presets.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAmountInput(String(value))}
                      className={`py-2 rounded-xl border font-mono font-bold cursor-pointer ${amount === value ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-[#140f22] border-purple-900/40 text-stone-300 hover:border-amber-400/60'}`}
                    >
                      ฿{value.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-amber-300 font-bold text-lg">฿</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 text-stone-100 px-3 py-2.5 rounded-xl font-mono text-base focus:outline-none focus:border-amber-400"
                  />
                </div>
                <span className={`text-[11px] ${amountError ? 'text-rose-300' : 'text-stone-500'}`}>
                  {amountError || `ขั้นต่ำ ฿${min.toLocaleString()} · สูงสุด ฿${max.toLocaleString()} ต่อครั้ง`}
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-stone-300 font-semibold block">ช่องทางชำระเงิน</span>
                <ChannelPicker channels={channels} selectedId={channelId} onSelect={setChannelId} />
              </div>

              <button
                type="button"
                onClick={next}
                disabled={!!amountError || !channel}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${amountError || !channel ? 'bg-stone-800 text-stone-500 cursor-not-allowed' : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-stone-950 hover:opacity-95 cursor-pointer'}`}
              >
                <Wallet className="w-4 h-4" />
                <span>เติมเงิน ฿{amount.toLocaleString()}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {busy && (
            <div className="py-10 flex flex-col items-center gap-3 text-stone-300">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <span>กำลังบันทึกรายการ…</span>
            </div>
          )}

          {step === 'pay' && channel && !busy && (
            <ExternalPaymentFlow
              channel={channel}
              amount={amount}
              payerName={currentUser.name}
              reference="เติมเงินเข้ากระเป๋า"
              onBack={() => setStep('amount')}
              onApproved={approved}
            />
          )}

          {step === 'done' && (
            <div className="py-4 text-center space-y-4">
              {pending ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center mx-auto">
                    <Clock className="w-9 h-9" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-100">ส่งสลิปเติมเงิน ฿{credited.toLocaleString()} แล้ว</h3>
                  <p className="text-stone-300 leading-relaxed">ยอดจะเข้ากระเป๋าเมื่อผู้ดูแลตรวจสอบสลิปเรียบร้อย (ดูสถานะได้ในแท็บกระเป๋าเงิน)</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
                    <Check className="w-9 h-9 stroke-[3]" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-100">เติมเงินสำเร็จ +฿{credited.toLocaleString()}</h3>
                  <p className="text-stone-300">ยอดคงเหลือใหม่ ฿{currentUser.balance.toLocaleString()}</p>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-bold text-stone-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 cursor-pointer"
              >
                เสร็จสิ้น
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
