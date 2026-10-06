import { ShieldCheck } from 'lucide-react'
import type { Quota, User } from '@/types'
import { KapsulepLogo } from '../KapsulepLogo'

interface WelcomeBannerProps {
  user: User
  quota: Quota
  onOpenKyc: () => void
  onDismiss: () => void
}

/** Strip under the header with the signed-in user's balance and quota. */
export function WelcomeBanner({ user, quota, onOpenKyc, onDismiss }: WelcomeBannerProps) {
  return (
    <div className="bg-gradient-to-r from-purple-950/70 via-[#130f21] to-rose-950/60 border-b border-rose-500/30 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <KapsulepLogo size={36} showGlow />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm font-['Prompt',sans-serif]">ยินดีต้อนรับสู่ระบบ: {user.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-[10px]">
                โควตาสูงสุด 2 บาน
              </span>
            </div>
            <p className="text-stone-300 text-[11px] mt-0.5 leading-snug font-['Prompt',sans-serif]">
              ยอดเงินในกระเป๋า: <strong className="text-rose-300 font-mono">฿{user.balance.toLocaleString()}</strong> ·
              ถือครองปัจจุบัน: <strong className="text-rose-300 font-mono">{quota.totalCount}/2 บาน</strong> (ไทย{' '}
              {quota.thailandCount}/1 + ภูมิภาค {quota.regionalCount}/1)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!user.isVerified && (
            <button
              onClick={onOpenKyc}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm font-['Prompt',sans-serif]"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ยืนยันตัวตน (KYC)</span>
            </button>
          )}
          <button
            onClick={onDismiss}
            className="px-2.5 py-1.5 rounded-lg bg-[#140f21] hover:bg-[#1b152d] text-stone-400 hover:text-stone-200 border border-purple-900/40 text-xs cursor-pointer font-['Prompt',sans-serif]"
          >
            รับทราบ
          </button>
        </div>
      </div>
    </div>
  )
}
