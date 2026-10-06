import { Check, CircleAlert, Tag, X } from 'lucide-react'
import type { AuthMode, Quota, User, WindowItem } from '@/types'
import { maskCitizenId } from '@/lib/identity'
import { RESALE_COMMISSION_RATE } from '@/lib/ownershipRules'
import { KapsulepLogo } from '../KapsulepLogo'

interface BuyResaleModalProps {
  windowItem: WindowItem
  currentUser: User | null
  quota: Quota
  onClose: () => void
  /** Called when the buyer confirms; the parent then asks how to pay. */
  onConfirmBuy: (windowId: number) => void
  onOpenAuth: (mode: AuthMode) => void
  onOpenKyc: () => void
}

export function BuyResaleModal({
  windowItem,
  currentUser,
  quota,
  onClose,
  onConfirmBuy,
  onOpenAuth,
  onOpenKyc,
}: BuyResaleModalProps) {
  if (!windowItem.resalePrice) return null

  const price = windowItem.resalePrice
  const hasEnoughBalance = currentUser ? currentUser.balance >= price : false
  const isThailand = windowItem.region === 'thailand'
  const isVerified = currentUser?.isVerified
  const canAcquireHere = isThailand ? quota.canAcquireThailand : quota.canAcquireRegional
  const quotaMessage = isThailand
    ? `คุณมีหน้าต่างบานประเทศไทยครบ 1 บานแล้ว (${quota.thailandWindow?.code})`
    : `คุณมีหน้าต่างบานภูมิภาคครบ 1 บานแล้ว (${quota.regionalWindow?.code})`
  const commission = Math.round(price * RESALE_COMMISSION_RATE)
  const sellerNet = price - commission
  const code = windowItem.code || `#${windowItem.id.toString().padStart(3, '0')}`

  const confirm = () => {
    if (!currentUser) return onOpenAuth('login')
    if (!isVerified) return onOpenKyc()
    if (canAcquireHere) onConfirmBuy(windowItem.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="relative w-full max-w-lg bg-[#110e1a] border border-purple-900/50 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-2.5">
            <KapsulepLogo size={28} showGlow />
            <span className="font-bold text-stone-100 text-sm sm:text-base font-['Outfit',sans-serif]">
              ซื้อต่อบานหน้าต่าง {code}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          <div className="flex items-center gap-3.5 p-3 bg-stone-950 rounded-xl border border-stone-800">
            <img src={windowItem.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-stone-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-mono text-rose-400 font-bold">บานที่ {code}</span>
              <h3 className="font-semibold text-stone-200 truncate mt-0.5">{windowItem.title}</h3>
              <p className="text-[11px] text-stone-400 truncate">ผู้ขายปัจจุบัน: {windowItem.ownerName}</p>
            </div>
          </div>

          <div className="p-4 bg-stone-950/80 rounded-xl border border-purple-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">ราคาซื้อต่อที่เจ้าของเดิมกำหนด:</span>
              <span className="font-mono text-xl font-bold text-rose-300">฿{price.toLocaleString()} THB</span>
            </div>
            <div className="p-2.5 bg-stone-900/90 rounded-lg border border-purple-500/30 text-xs space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-rose-400 font-sans font-bold">
                <span>⚡ เงื่อนไขระบบ (หักค่าคอมมิชชั่น 5%):</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">Commission 5%</span>
              </div>
              <div className="flex items-center justify-between text-stone-400 text-[11px]">
                <span>• ค่าคอมมิชชั่นเข้าระบบ (5%):</span>
                <span className="text-rose-400 font-bold">฿{commission.toLocaleString()} THB</span>
              </div>
              <div className="flex items-center justify-between text-stone-400 text-[11px]">
                <span>• ยอดเงินสุทธิโอนเข้ากระเป๋าผู้ขายเดิม (95%):</span>
                <span className="text-emerald-400 font-bold">฿{sellerNet.toLocaleString()} THB</span>
              </div>
            </div>
            {currentUser ? (
              <>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-850">
                  <span className="text-stone-400">ยอดเงินในกระเป๋าของคุณ ({currentUser.name}):</span>
                  <span className={`font-mono font-semibold ${hasEnoughBalance ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ฿{currentUser.balance.toLocaleString()} THB
                  </span>
                </div>
                {hasEnoughBalance && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-stone-500">คงเหลือหลังการทำรายการ:</span>
                    <span className="font-mono text-stone-300">฿{(currentUser.balance - price).toLocaleString()} THB</span>
                  </div>
                )}
              </>
            ) : (
              <div className="pt-2 border-t border-stone-800 text-stone-400 text-[11px]">กรุณาเข้าสู่ระบบก่อนทำการซื้อต่อ</div>
            )}
          </div>

          {currentUser && (
            <div className="p-3 bg-stone-950 rounded-xl border border-stone-850 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-300 font-medium">โควตาการถือครอง ({maskCitizenId(currentUser.citizenId)}):</span>
                <span className="font-mono text-rose-400 font-bold">{quota.totalCount}/2 บาน</span>
              </div>
              {!canAcquireHere && (
                <div className="p-2 rounded bg-purple-950/40 border border-purple-500/40 text-rose-300 text-[11px] flex items-center gap-1.5">
                  <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{quotaMessage} (โควตาสูงสุด: ไทย 1 บาน + ภูมิภาค 1 บาน)</span>
                </div>
              )}
              {!isVerified && (
                <div className="p-2.5 rounded bg-purple-950/30 border border-purple-500/40 flex items-center justify-between text-rose-300 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>ต้องยืนยันตัวตน (KYC) ก่อนทำการซื้อต่อ</span>
                  </span>
                  <button
                    type="button"
                    onClick={onOpenKyc}
                    className="px-2 py-0.5 rounded bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold text-[10px] cursor-pointer"
                  >
                    ยืนยันตัวตน
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="p-3.5 bg-stone-950 rounded-xl border border-stone-850 space-y-1.5 text-stone-300 text-xs">
            <div className="flex items-center gap-1.5 text-rose-300 font-medium mb-1">
              <Check className="w-4 h-4" />
              <span>สิทธิ์ที่คุณจะได้รับทันทีหลังการซื้อต่อ:</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed font-light">
              • กรรมสิทธิ์บานหน้าต่างจะถูกโอนเป็นชื่อของคุณทันที
              <br />• คุณสามารถลงรูปภาพส่วนตัวใหม่ของคุณได้ทันที
              <br />• สิทธิ์แก้ไขรูปภาพและข้อความ (1 ครั้ง / 24 ชม.)
              <br />• สิทธิ์นำกลับมาตั้งราคาเปิดขายต่อให้ผู้อื่นได้ตลอดเวลา
            </p>
          </div>

          {currentUser ? (
            <button
              onClick={confirm}
              disabled={!canAcquireHere}
              className={`w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${canAcquireHere ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 shadow-rose-500/20' : 'bg-stone-800 text-stone-500 cursor-not-allowed'}`}
            >
              <Tag className="w-4 h-4" />
              <span>
                {isVerified
                  ? canAcquireHere
                    ? `ยืนยันการซื้อ และไปชำระเงิน (฿${price.toLocaleString()} THB)`
                    : 'โควตาการถือครองเต็มแล้ว (จำกัด 2 บาน)'
                  : 'กดยืนยันตัวตน (KYC) ก่อนชำระเงิน'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onOpenAuth('login')}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>เข้าสู่ระบบหรือสมัครสมาชิกเพื่อซื้อต่อ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
