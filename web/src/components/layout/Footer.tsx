import type { AuthMode, HubTab, User } from '@shared/types'
import { editPolicyLabel, useSettings } from '@/lib/settings'
import { KapsulepLogo } from '../KapsulepLogo'

interface FooterProps {
  currentUser: User | null
  onBackToWelcome: () => void
  onOpenHub: (tab: HubTab) => void
  onOpenAuth: (mode: AuthMode) => void
}

export function Footer({ currentUser, onBackToWelcome, onOpenHub, onOpenAuth }: FooterProps) {
  const { editPolicy } = useSettings()
  return (
    <footer className="border-t border-purple-900/30 bg-[#09080e] px-4 py-8 text-center text-xs text-stone-400 space-y-3 font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-stone-300 font-medium">
        <button
          onClick={onBackToWelcome}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent font-semibold hover:opacity-80 cursor-pointer"
        >
          <KapsulepLogo size={18} />
          <span>500 Windows to Thailand</span>
        </button>
        <span>·</span>
        <span>6 ภูมิภาคย่อย ภาคละ 500 บาน (รวม 3,500 บาน)</span>
        <span>·</span>
        <button onClick={() => onOpenHub('rules')} className="hover:text-rose-300 cursor-pointer font-['Prompt',sans-serif]">
          กติกา & สิทธิ์การใช้งาน
        </button>
        <span>·</span>
        <button onClick={() => onOpenHub('wallet')} className="hover:text-rose-300 cursor-pointer font-['Prompt',sans-serif]">
          กระเป๋าเงิน & บัญชี
        </button>
        {!currentUser && (
          <>
            <span>·</span>
            <button
              onClick={() => onOpenAuth('login')}
              className="text-rose-400 hover:underline cursor-pointer font-semibold font-['Prompt',sans-serif]"
            >
              เข้าสู่ระบบ / สมัครสมาชิก
            </button>
          </>
        )}
      </div>
      <p className="text-[11px] text-stone-400 max-w-2xl mx-auto leading-relaxed font-light font-['Prompt',sans-serif]">
        สวัสดีประเทศไทย ขอต้อนรับสู่หน้าต่างบานแรกของทุกคน เรามาประกาศให้โลกรู้ ว่าหน้าต่างบานนี้ มีฉันอยู่ตรงนี้ (ภายใต้เงื่อนไขที่กำหนด)
        เป็นเจ้าของบานหน้าต่างส่วนตัว เงื่อนไขการขายต่อ (หักค่าคอมมิชชั่น 5%) และ{editPolicyLabel(editPolicy)}
        ผู้ใช้งานอ้างอิงเลขบัตรประชาชน 13 หลักและเบอร์โทรศัพท์ สามารถมีหน้าต่างได้ไม่เกิน 2 บาน (ไทย 1 บาน + ภูมิภาค 1 บาน)
        และหากจะทำการซื้อหรือขายต่อ ต้องยืนยันตัวตน (KYC) เท่านั้น
      </p>
      <div className="pt-2 text-xs text-stone-400 flex items-center justify-center gap-2">
        <span className="text-[11px] text-stone-400 tracking-wider uppercase font-mono">Power by</span>
        <div className="flex items-center gap-1.5">
          <KapsulepLogo size={18} showGlow />
          <span className="font-['Outfit',sans-serif] font-bold bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent text-sm tracking-wide">
            Kapsulep
          </span>
        </div>
        <span className="text-stone-600">·</span>
        <span className="text-[11px] text-stone-400">All rights reserved © 2026</span>
      </div>
    </footer>
  )
}
