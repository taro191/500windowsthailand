import { useEffect, useState } from 'react'
import { Check, Clock, Sparkles, X } from 'lucide-react'
import type { PaymentBreakdown, User, WindowItem } from '@shared/types'
import { REGIONS_BY_ID } from '@shared/regions'
import { KapsulepLogo } from '../KapsulepLogo'
import { PaymentPanel, type ConfirmResult } from './PaymentPanel'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'claim' | 'resale'
  windowItem: WindowItem | null
  currentUser: User | null
  amount: number
  /** Performs the purchase; the modal shows the result. */
  onConfirm: (payment: PaymentBreakdown) => Promise<ConfirmResult>
  onOpenTopUp: () => void
}

/** Paying for a window claim or resale (wallet first, rest through a channel). */
export function CheckoutModal({ isOpen, onClose, mode, windowItem, currentUser, amount, onConfirm, onOpenTopUp }: CheckoutModalProps) {
  const [result, setResult] = useState<{ payment: PaymentBreakdown; pending: boolean } | null>(null)
  useEffect(() => {
    if (isOpen) setResult(null)
  }, [isOpen, windowItem?.id])

  if (!isOpen || !windowItem || !currentUser) return null

  const region = REGIONS_BY_ID[windowItem.region]
  const code = windowItem.code || `#${windowItem.id.toString().padStart(3, '0')}`

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
              <span className="font-bold text-stone-100 text-sm sm:text-base font-['Outfit',sans-serif] block leading-tight">
                {!result ? 'ชำระเงิน' : result.pending ? 'ส่งสลิปแล้ว รอตรวจสอบ' : 'ชำระเงินสำเร็จ พร้อมใช้งาน!'}
              </span>
              <span className="text-[11px] text-stone-400 font-light">
                {mode === 'claim' ? 'จับจองบานใหม่' : 'ซื้อต่อบานหน้าต่าง'} {code} ({region?.name}) · ฿{amount.toLocaleString()}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {!result ? (
            <PaymentPanel
              payer={currentUser}
              amount={amount}
              itemLabel={`หน้าต่างบานที่ ${code}`}
              reference={code}
              onConfirm={onConfirm}
              onPaid={(payment, pending) => setResult({ payment, pending })}
              onOpenTopUp={onOpenTopUp}
            />
          ) : result.pending ? (
            <div className="py-4 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center mx-auto">
                <Clock className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-100 font-['Outfit',sans-serif]">ส่งสลิปเรียบร้อย รอผู้ดูแลตรวจสอบ</h3>
                <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                  บานที่ <strong className="text-rose-300 font-mono">{code}</strong> ถูกจองไว้ให้คุณแล้ว เมื่อผู้ดูแลยืนยันยอดโอน
                  ระบบจะโอนสิทธิ์ให้ทันที · ถ้าสลิปไม่ผ่าน ยอดที่ตัดจากกระเป๋าจะคืนเข้ากระเป๋าอัตโนมัติ
                </p>
              </div>
              <PaymentSummary payment={result.payment} total={amount} />
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 cursor-pointer"
              >
                ตกลง
              </button>
            </div>
          ) : (
            <div className="py-4 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-9 h-9 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-100 font-['Outfit',sans-serif]">อนุมัติการซื้อสำเร็จ พร้อมใช้งาน!</h3>
                <p className="text-xs text-stone-300 mt-1">
                  หน้าต่างบานที่ <strong className="text-rose-300 font-mono">{code}</strong> โอนกรรมสิทธิ์เข้าสู่บัญชีของคุณเรียบร้อยแล้ว
                </p>
              </div>
              <PaymentSummary payment={result.payment} total={amount} />
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 via-rose-500 to-purple-600 hover:opacity-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>ไปยังหน้าต่างของคุณ</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Receipt lines: wallet part, external part, reference and total. */
export function PaymentSummary({ payment, total }: { payment: PaymentBreakdown; total: number }) {
  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between text-stone-400">
      <span>{label}</span>
      <span className={strong ? 'text-emerald-400 font-bold' : 'text-stone-200'}>{value}</span>
    </div>
  )
  return (
    <div className="p-3.5 rounded-xl bg-[#09080e] border border-emerald-500/30 text-left space-y-1.5 font-mono text-xs">
      {row('ตัดจากกระเป๋าเงิน:', `฿${payment.walletAmount.toLocaleString()}`)}
      {payment.externalAmount > 0 && row(`ชำระผ่าน ${payment.channelName}:`, `฿${payment.externalAmount.toLocaleString()}`)}
      {payment.slip?.slipRef && row('เลขที่รายการ:', payment.slip.slipRef)}
      {row('รวมที่ชำระ:', `฿${total.toLocaleString()}.00`, true)}
    </div>
  )
}
