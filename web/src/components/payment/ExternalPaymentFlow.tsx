// Paying an amount through one external channel: instructions → transfer slip (checked
// later by an admin) or card (simulated gateway until one is chosen). Used by checkout
// (for the part the wallet doesn't cover) and top-up.
import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleCheck, Clock, Copy, CreditCard, Receipt, Sparkles, Upload } from 'lucide-react'
import type { PaymentChannel, PaymentSlip } from '@shared/types'
import { BANKS } from '@shared/banks'
import { isDemo } from '@/lib/store'
import { resizeImageFile } from '@/lib/promo'
import { drawDemoSlip, makeSlipReference } from '@/lib/demoSlip'
import { SLIP_CHANNEL_TYPES } from '@/lib/settings'

type Step = 'pay' | 'slip' | 'verifying'

interface ExternalPaymentFlowProps {
  channel: PaymentChannel
  amount: number
  payerName: string
  /** Shown on the demo slip, e.g. a window code or "เติมเงิน". */
  reference: string
  onBack: () => void
  /** Slip attached (sent for review) or card payment approved by the gateway. */
  onApproved: (slip: PaymentSlip) => void
}

export function ExternalPaymentFlow({ channel, amount, payerName, reference, onBack, onApproved }: ExternalPaymentFlowProps) {
  const [step, setStep] = useState<Step>('pay')
  const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const [slipRef, setSlipRef] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [fileError, setFileError] = useState('')
  const usesSlip = SLIP_CHANNEL_TYPES.includes(channel.type)

  // Card only: the gateway is simulated until a provider is chosen.
  useEffect(() => {
    if (step !== 'verifying') return
    const steps: [number, number, string][] = [
      [0, 30, '🔐 (จำลอง) เชื่อมต่อ Payment Gateway...'],
      [900, 70, `💳 (จำลอง) อนุมัติรายการบัตร (฿${amount.toLocaleString()})...`],
      [1800, 100, '✅ ชำระผ่านบัตรสำเร็จ (จำลอง)'],
    ]
    const timers = steps.map(([delay, percent, text]) =>
      setTimeout(() => {
        setProgress(percent)
        setProgressText(text)
      }, delay),
    )
    timers.push(setTimeout(() => onApproved({ slipUrl: '', slipRef: '' }), 2300))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  /** Slips are downscaled to a JPEG before upload (still readable, much smaller). */
  const handleFile = async (file?: File) => {
    if (!file) return
    setFileError('')
    try {
      setSlipUrl(await resizeImageFile(file, 1600))
    } catch {
      setFileError('อ่านไฟล์รูปไม่ได้ กรุณาเลือกไฟล์ภาพสลิปใหม่')
    }
  }

  const createDemoSlip = () => {
    const ref = makeSlipReference('KPLUS')
    setSlipRef(ref)
    setSlipUrl(drawDemoSlip({ amount, payerName, windowCode: reference, reference: ref }))
  }

  if (step === 'verifying') {
    return (
      <div className="py-8 px-4 text-center space-y-6 animate-in fade-in duration-200">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 via-rose-500 to-purple-600 p-[2px] shadow-xl flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#110e1a] flex items-center justify-center">
              <Clock className="w-8 h-8 animate-spin text-rose-400" />
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-base font-bold text-stone-100 font-['Outfit',sans-serif]">กำลังชำระผ่านบัตร...</h3>
          <p className="text-xs text-rose-300 mt-1 font-mono font-medium">{progressText}</p>
        </div>
        <div className="max-w-xs mx-auto space-y-1.5">
          <div className="w-full bg-[#1e1730] rounded-full h-2 overflow-hidden border border-purple-900/40">
            <div
              className="h-full bg-gradient-to-r from-orange-500 via-rose-500 to-emerald-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-stone-500 font-mono">
            <span>กำลังประมวลผล</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'slip') {
    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs space-y-1">
          <div className="text-rose-300 font-bold flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-rose-400" />
            <span>แนบสลิปเพื่อยืนยันการชำระผ่าน {channel.name}</span>
          </div>
          <p className="text-[11px] text-stone-300 font-light leading-relaxed">
            แนบภาพสลิปการโอนเงินจำนวน <strong className="font-mono text-rose-300 font-bold">฿{amount.toLocaleString()}</strong> ·
            ผู้ดูแลจะตรวจสอบสลิปและยืนยันรายการให้ (ระหว่างนี้ระบบจองรายการไว้ให้คุณ)
          </p>
        </div>

        {slipUrl ? (
          <div className="p-3 rounded-2xl bg-[#09080e] border border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CircleCheck className="w-4 h-4" />
                <span>แนบสลิปเรียบร้อยแล้ว</span>
              </span>
              <button type="button" onClick={() => setSlipUrl(null)} className="text-[11px] text-stone-400 hover:text-rose-300 underline cursor-pointer">
                เปลี่ยนรูปสลิป
              </button>
            </div>
            <div className="max-h-56 overflow-hidden rounded-xl border border-stone-800 bg-black flex items-center justify-center">
              <img src={slipUrl} alt="Payment Slip" className="max-h-56 object-contain" />
            </div>
            <label className="flex items-center justify-between gap-2 text-[11px] text-stone-400 pt-1 border-t border-purple-900/20">
              <span className="shrink-0">เลขที่รายการบนสลิป (ถ้ามี):</span>
              <input
                value={slipRef}
                onChange={(e) => setSlipRef(e.target.value.slice(0, 60))}
                placeholder="เช่น 0161234567890"
                className="min-w-0 flex-1 bg-stone-950 border border-stone-700 rounded-lg px-2 py-1 font-mono text-stone-200 focus:outline-none focus:border-rose-400"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="border-2 border-dashed border-purple-900/50 hover:border-rose-500/60 rounded-2xl p-6 text-center block cursor-pointer transition-colors bg-[#09080e]/60">
              <Upload className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <span className="text-xs font-bold text-stone-200 block">คลิกเพื่ออัปโหลดรูปภาพสลิปจากอุปกรณ์</span>
              <span className="text-[10px] text-stone-400 block mt-1 font-light">รองรับไฟล์ภาพ JPG, PNG, WEBP</span>
              <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />
            </label>
            {fileError && <p className="text-[11px] text-rose-300">{fileError}</p>}
            {isDemo() && (
              <button
                type="button"
                onClick={createDemoSlip}
                className="w-full py-2.5 px-3 rounded-xl bg-[#171129] hover:bg-[#201738] border border-purple-500/40 text-rose-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Sparkles className="w-4 h-4 text-rose-400" />
                <span>⚡ สร้างสลิปตัวอย่างอัตโนมัติ (Demo e-Slip)</span>
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setStep('pay')}
            className="px-4 py-2.5 rounded-xl bg-[#140f22] hover:bg-[#1a142c] border border-purple-900/30 text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer"
          >
            ย้อนกลับ
          </button>
          <button
            type="button"
            disabled={!slipUrl}
            onClick={() => slipUrl && onApproved({ slipUrl, slipRef: slipRef.trim() })}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${slipUrl ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white shadow-lg shadow-rose-500/20 hover:opacity-95' : 'bg-stone-800 text-stone-500 cursor-not-allowed'}`}
          >
            <span>ส่งสลิปให้ผู้ดูแลตรวจสอบ</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <ChannelInstructions channel={channel} amount={amount} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl bg-[#140f22] hover:bg-[#1a142c] border border-purple-900/30 text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer"
        >
          ย้อนกลับ
        </button>
        <button
          type="button"
          onClick={() => setStep(usesSlip ? 'slip' : 'verifying')}
          className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 shadow-lg shadow-rose-500/20 cursor-pointer flex items-center justify-center gap-2"
        >
          <span>{usesSlip ? 'โอนเรียบร้อยแล้ว: แนบสลิป' : `ชำระด้วยบัตร ฿${amount.toLocaleString()} (จำลอง)`}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/** How to pay through a channel: QR, bank account, TrueMoney number or card gateway. */
function ChannelInstructions({ channel, amount }: { channel: PaymentChannel; amount: number }) {
  const [copied, setCopied] = useState(false)
  const bank = BANKS.find((b) => b.code === channel.bankCode)
  const copy = () => {
    navigator.clipboard?.writeText((channel.accountNumber || '').replace(/-/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (channel.type === 'card') {
    return (
      <div className="p-4 rounded-2xl bg-[#09080e] border border-purple-900/40 space-y-3 text-xs">
        <div className="flex items-center gap-2 text-stone-200 font-bold">
          <CreditCard className="w-5 h-5 text-rose-400" />
          <span>{channel.name}</span>
        </div>
        <p className="text-[11px] text-stone-400 leading-relaxed">
          ระบบจะพาไปยังหน้าชำระเงินของผู้ให้บริการ Payment Gateway เพื่อกรอกข้อมูลบัตรอย่างปลอดภัย
          (500 Windows ไม่ได้เก็บเลขบัตรของคุณ) {channel.note && `· ${channel.note}`}
        </p>
        <div className="flex justify-between font-mono text-stone-300">
          <span>ยอดที่จะชำระ</span>
          <strong className="text-rose-300">฿{amount.toLocaleString()}.00</strong>
        </div>
      </div>
    )
  }

  const badge =
    channel.type === 'promptpay'
      ? { text: 'PromptPay', color: 'bg-sky-700' }
      : channel.type === 'truemoney'
        ? { text: 'TrueMoney', color: 'bg-orange-600' }
        : { text: bank?.text || 'BANK', color: bank?.color || 'bg-purple-700' }

  return (
    <div className="p-4 rounded-2xl bg-[#09080e] border border-purple-900/40 space-y-3 text-xs">
      {channel.type === 'promptpay' && (
        <div className="text-center space-y-2">
          <div className="inline-block p-3 rounded-2xl bg-white shadow-lg">
            <MockQr />
          </div>
          <div className="text-[11px] text-stone-400">สแกนจ่ายผ่านแอปธนาคารใดก็ได้</div>
        </div>
      )}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#140f22] border border-purple-900/30">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`px-2 h-10 min-w-10 rounded-xl ${badge.color} flex items-center justify-center font-bold text-white text-[10px]`}>
            {badge.text}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-stone-200 truncate">{channel.name}</div>
            <div className="font-mono text-stone-300 text-sm font-semibold">{channel.accountNumber}</div>
            {channel.accountName && <div className="text-[10px] text-stone-400 truncate">ชื่อบัญชี: {channel.accountName}</div>}
          </div>
        </div>
        <button
          type="button"
          onClick={copy}
          className="px-2.5 py-1.5 rounded-lg bg-[#1e1730] hover:bg-[#281f40] border border-purple-500/30 text-stone-200 text-xs font-mono flex items-center gap-1 cursor-pointer shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
        </button>
      </div>
      <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-900/30 text-stone-400 text-[11px] leading-relaxed">
        * โอนเงินตามยอด <strong className="text-rose-300 font-mono font-bold">฿{amount.toLocaleString()}.00</strong> พอดี
        แล้วกดปุ่มด้านล่างเพื่อแนบสลิป {channel.note && `· ${channel.note}`}
      </div>
    </div>
  )
}

/** Decorative stand-in for a PromptPay QR (not scannable). */
function MockQr() {
  const dark = '#003b64'
  const finder = (x: number, y: number) => (
    <>
      <rect x={x} y={y} width="40" height="40" fill={dark} />
      <rect x={x + 6} y={y + 6} width="28" height="28" fill="white" />
      <rect x={x + 12} y={y + 12} width="16" height="16" fill={dark} />
    </>
  )
  return (
    <svg width="160" height="160" viewBox="0 0 180 180" className="block">
      <rect width="180" height="180" fill="white" />
      {finder(10, 10)}
      {finder(130, 10)}
      {finder(10, 130)}
      <path
        d="M60 15h10v10h-10zM80 15h15v10h-15zM105 15h15v10h-15zM60 35h15v15h-15zM85 35h10v10h-10zM105 35h15v15h-15zM15 60h15v15h-15zM35 60h15v15h-15zM60 60h20v20h-20zM90 60h15v10h-15zM115 60h15v15h-15zM140 60h25v15h-25zM15 85h25v15h-25zM50 85h15v20h-15zM115 85h20v15h-20zM145 85h20v25h-20zM15 110h20v10h-20zM45 110h15v10h-15zM70 110h25v15h-25zM105 110h20v15h-20zM60 135h15v15h-15zM85 135h15v15h-15zM110 135h20v15h-20zM140 135h25v20h-25zM60 155h20v15h-20zM90 155h15v15h-15zM115 155h15v15h-15zM140 160h25v10h-25z"
        fill={dark}
      />
      <rect x="72" y="72" width="36" height="36" rx="6" fill={dark} />
      <text x="90" y="94" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
        TH-QR
      </text>
    </svg>
  )
}
