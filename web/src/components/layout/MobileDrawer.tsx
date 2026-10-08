import { Check, ChevronRight, CircleAlert, Compass, Gauge, LogOut, MapPin, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react'
import type { AuthMode, HubTab, RegionId, StatusCounts, StatusFilter, User } from '@shared/types'
import { REGIONS, REGIONS_BY_ID } from '@shared/regions'
import { maskPhone } from '@shared/identity'
import { KapsulepLogo } from '../KapsulepLogo'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeRegion: RegionId
  onSelectRegion: (region: RegionId) => void
  currentUser: User | null
  onOpenAuth: (mode: AuthMode) => void
  onOpenKyc: () => void
  onLogout: () => void
  onOpenHub: (tab: HubTab) => void
  onBackToWelcome: () => void
  onOpenTopUp?: () => void
  /** Only passed for admins. */
  onOpenAdmin?: () => void
  statusFilter: StatusFilter
  setStatusFilter: (filter: StatusFilter) => void
  counts: StatusCounts
}

/** Phone menu: account, region picker, filters and shortcuts into the Hub. */
export function MobileDrawer({
  isOpen,
  onClose,
  activeRegion,
  onSelectRegion,
  currentUser,
  onOpenAuth,
  onOpenKyc,
  onLogout,
  onOpenHub,
  onBackToWelcome,
  onOpenTopUp,
  onOpenAdmin,
  statusFilter,
  setStatusFilter,
  counts,
}: MobileDrawerProps) {
  if (!isOpen) return null
  const region = REGIONS_BY_ID[activeRegion]

  /** Close the drawer, then run the action. */
  const then = (action: () => void) => () => {
    onClose()
    action()
  }
  const pickFilter = (filter: StatusFilter) => {
    setStatusFilter(filter)
    onClose()
  }

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: `ทั้งหมด (${counts.all})` },
    { id: 'available', label: `ว่าง (${counts.available})` },
    { id: 'for_resale', label: `เปิดขายต่อ (${counts.for_resale})` },
    { id: 'occupied', label: `มีภาพแล้ว (${counts.occupied})` },
  ]
  const effectFilters: { id: StatusFilter; label: string }[] = [
    { id: 'fx_hot', label: `🔥 ฮอต (${counts.fx_hot || 0})` },
    { id: 'fx_new', label: `✨ ใหม่ (${counts.fx_new || 0})` },
    { id: 'fx_daily', label: `🟢 อัปเดตวันนี้ (${counts.fx_daily || 0})` },
    { id: 'fx_star', label: `⭐ ดัง (${counts.fx_star || 0})` },
  ]
  const hubLinks: { tab: HubTab; icon: typeof Compass; label: string }[] = [
    { tab: 'rules', icon: Compass, label: 'กติกา 5 ข้อ & เงื่อนไขการถือครอง 2 บาน' },
    { tab: 'wallet', icon: Wallet, label: 'กระเป๋าเงิน & ประวัติธุรกรรม (ค่าคอมมิชชั่น 5%)' },
    { tab: 'stats', icon: Sparkles, label: 'สถิติตลาดซื้อขายต่อ & โครงสร้าง 3,500 บาน' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="w-full max-w-sm bg-[#0e0b17] border-l border-purple-900/40 h-full flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-2.5">
            <KapsulepLogo size={32} showGlow />
            <div>
              <h2 className="font-bold text-stone-100 text-sm font-['Prompt',sans-serif]">ข้อมูลและการตั้งค่า</h2>
              <span className="text-[10px] text-stone-400 font-mono">kapsulep.com · 500 Windows</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
          <button
            onClick={then(onBackToWelcome)}
            className="w-full p-2.5 rounded-xl bg-gradient-to-r from-orange-950/40 via-purple-950/40 to-[#120f1e] border border-rose-500/30 text-rose-300 font-semibold flex items-center justify-between cursor-pointer hover:border-rose-400/50 transition-colors font-['Prompt',sans-serif]"
          >
            <div className="flex items-center gap-2">
              <KapsulepLogo size={20} showGlow />
              <span>กลับหน้าแรก (500 Windows)</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </button>

          {onOpenAdmin && (
            <button
              onClick={then(onOpenAdmin)}
              className="w-full p-2.5 rounded-xl bg-[#007bff] text-white font-semibold flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Gauge className="w-4 h-4" /> ระบบผู้ดูแล (Admin)
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {currentUser ? (
            <div className="p-3.5 rounded-xl bg-[#120f1e] border border-purple-900/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border border-rose-400/80" />
                    {currentUser.isVerified && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center text-[9px] font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-stone-100 truncate text-xs font-['Prompt',sans-serif]">{currentUser.name}</div>
                    <div className="text-[10px] text-stone-400 font-mono">{maskPhone(currentUser.phone)}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-rose-300 font-bold text-xs block">฿{currentUser.balance.toLocaleString()}</span>
                  {onOpenTopUp && (
                    <button onClick={then(onOpenTopUp)} className="text-[10px] text-amber-400 font-bold underline cursor-pointer">
                      + เติมเงิน
                    </button>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-purple-900/30 flex items-center justify-between">
                {currentUser.isVerified ? (
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 font-['Prompt',sans-serif]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ยืนยันตัวตนแล้ว (KYC ✓)</span>
                  </span>
                ) : (
                  <button
                    onClick={then(onOpenKyc)}
                    className="text-[10px] text-rose-300 hover:underline flex items-center gap-1 font-bold cursor-pointer font-['Prompt',sans-serif]"
                  >
                    <CircleAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>ยังไม่ยืนยันตัวตน (คลิกเพื่อยืนยัน)</span>
                  </button>
                )}
                <div className="flex items-center gap-1.5 font-['Prompt',sans-serif]">
                  {onOpenAdmin && (
                    <button
                      onClick={then(onOpenAdmin)}
                      className="px-2 py-1 rounded bg-[#181329] hover:bg-stone-800 text-sky-300 border border-sky-900/60 text-[10px] font-medium cursor-pointer flex items-center gap-1"
                    >
                      <Gauge className="w-3 h-3" /> Admin
                    </button>
                  )}
                  <button
                    onClick={then(onLogout)}
                    aria-label="ออกจากระบบ"
                    className="px-2 py-1 rounded bg-[#181329] hover:bg-stone-800 text-rose-300 border border-rose-900/60 text-[10px] font-medium cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/50 space-y-2 font-['Prompt',sans-serif]">
              <span className="font-bold text-rose-300 block text-xs">คุณยังไม่ได้เข้าสู่ระบบ</span>
              <p className="text-[11px] text-stone-300 leading-relaxed font-light">
                เข้าสู่ระบบเพื่อจับจองหน้าต่างส่วนตัว (500 ฿ ตลอดชีพ) และจัดการกระเป๋าเงิน
              </p>
              <div className="flex items-center gap-2 pt-1 font-['Prompt',sans-serif]">
                <button
                  onClick={then(() => onOpenAuth('login'))}
                  className="flex-1 py-1.5 bg-[#120f1e] hover:bg-[#1a142c] text-stone-200 border border-purple-900/40 rounded-lg text-xs font-bold text-center"
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  onClick={then(() => onOpenAuth('signup'))}
                  className="flex-1 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-lg text-xs font-bold text-center"
                >
                  สมัครสมาชิก
                </button>
              </div>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>เลือกหน้าต่างภูมิภาค</span>
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                {region.name} ({region.codePrefix})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {REGIONS.map((r) => {
                const isActive = activeRegion === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      onSelectRegion(r.id)
                      onClose()
                    }}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${isActive ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-bold' : 'bg-stone-900/80 text-stone-400 border-stone-800 hover:text-stone-200'}`}
                  >
                    <span className="truncate flex items-center gap-1">
                      <span>{r.icon}</span>
                      <span className="truncate">{r.name.replace('ภาค', '')}</span>
                    </span>
                    {isActive && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
            <span className="font-bold text-stone-200 text-xs block">กรองสถานะหน้าต่าง:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {statusFilters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => pickFilter(f.id)}
                  className={`p-2 rounded-lg border text-left cursor-pointer ${statusFilter === f.id ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold' : 'bg-stone-900 text-stone-400 border-stone-800'}`}
                >
                  {f.label}
                </button>
              ))}
              {currentUser && (
                <button
                  onClick={() => pickFilter('my')}
                  className={`p-2 rounded-lg border text-left cursor-pointer col-span-2 ${statusFilter === 'my' ? 'bg-purple-500/20 text-purple-300 border-purple-500 font-bold' : 'bg-stone-900 text-stone-400 border-stone-800'}`}
                >
                  บานของฉัน ({counts.my})
                </button>
              )}
              {currentUser && (
                <button
                  onClick={() => pickFilter('follow')}
                  className={`p-2 rounded-lg border text-left cursor-pointer col-span-2 ${statusFilter === 'follow' ? 'bg-purple-500/20 text-purple-300 border-purple-500 font-bold' : 'bg-stone-900 text-stone-400 border-stone-800'}`}
                >
                  🔔 กำลังติดตาม ({counts.follow || 0}) · ทุกภูมิภาค
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
            <span className="font-bold text-stone-200 text-xs block">เอฟเฟกต์พิเศษ:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {effectFilters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => pickFilter(statusFilter === f.id ? 'all' : f.id)}
                  className={`p-2 rounded-lg border text-left cursor-pointer ${statusFilter === f.id ? 'bg-stone-800 text-amber-300 border-amber-400 font-bold' : 'bg-stone-900 text-stone-400 border-stone-800'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {hubLinks.map(({ tab, icon: Icon, label }) => (
              <button
                key={tab}
                onClick={then(() => onOpenHub(tab))}
                className="w-full p-2.5 bg-stone-950 hover:bg-stone-850 border border-stone-800 rounded-xl text-left flex items-center justify-between cursor-pointer text-stone-200 hover:text-amber-300 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-amber-400" />
                  <span>{label}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-stone-500" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
