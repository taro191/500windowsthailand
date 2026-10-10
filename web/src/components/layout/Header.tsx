import { useState } from 'react'
import { ChevronDown, Compass, Gauge, History, LayoutGrid, LogOut, Menu, Search, ShieldCheck, UserCheck, UserCog, Wallet, X } from 'lucide-react'
import type { AuthMode, HubTab, Quota, RegionId, User, ZoomLevel } from '@shared/types'
import { REGIONS_BY_ID } from '@shared/regions'
import { maskPhone } from '@shared/identity'
import { KapsulepLogo } from '../KapsulepLogo'

interface HeaderProps {
  activeRegion: RegionId
  onOpenRegionMenu: () => void
  onOpenHub: (tab: HubTab) => void
  currentUser: User | null
  quota: Quota
  onOpenAuth: (mode: AuthMode) => void
  onOpenKyc: () => void
  onOpenProfile: () => void
  onOpenWalletHistory: () => void
  onLogout: () => void
  onBackToWelcome: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  zoomLevel: ZoomLevel
  setZoomLevel: (zoom: ZoomLevel) => void
  onOpenMobileDrawer: () => void
  onOpenTopUp?: () => void
  /** Only passed for admins. */
  onOpenAdmin?: () => void
}

const ZOOM_OPTIONS: { id: ZoomLevel; label: string }[] = [
  { id: 'compact', label: '500 บาน' },
  { id: 'medium', label: 'มาตรฐาน' },
  { id: 'large', label: 'ขยาย' },
]

export function Header({
  activeRegion,
  onOpenRegionMenu,
  onOpenHub,
  currentUser,
  quota,
  onOpenAuth,
  onOpenKyc,
  onOpenProfile,
  onOpenWalletHistory,
  onLogout,
  onBackToWelcome,
  searchQuery,
  setSearchQuery,
  zoomLevel,
  setZoomLevel,
  onOpenMobileDrawer,
  onOpenTopUp,
  onOpenAdmin,
}: HeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const region = REGIONS_BY_ID[activeRegion]
  const isThailandBoard = region.isCoreHeart

  return (
    <header className="sticky top-0 z-40 bg-[#09080e]/95 backdrop-blur-md border-b border-purple-900/30 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 transition-all shadow-2xl font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      {/* Mobile */}
      <div className="sm:hidden flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onBackToWelcome}
              className="flex items-center gap-2 cursor-pointer hover:opacity-95 transition-opacity"
              title="กลับสู่หน้าแรก 500 Windows to Thailand"
            >
              <KapsulepLogo size={32} showGlow />
              <div className="flex flex-col text-left truncate">
                <div className="flex items-baseline gap-1">
                  <span className="font-['Outfit',sans-serif] font-bold text-sm tracking-tight bg-gradient-to-r from-white via-rose-100 to-amber-200 bg-clip-text text-transparent truncate">
                    500 Windows
                  </span>
                  <span className="font-['Outfit',sans-serif] font-semibold text-xs bg-gradient-to-r from-orange-400 to-purple-400 bg-clip-text text-transparent">
                    to Thailand
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                  <span className="font-['Prompt',sans-serif] text-stone-300 font-light truncate">
                    {isThailandBoard ? '500 หน้าต่างสู่ประเทศไทย' : region.name}
                  </span>
                  <span className="text-stone-600">·</span>
                  <span className="font-mono text-rose-400/90 text-[9px]">Kapsulep.com</span>
                </div>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onBackToWelcome}
              className="px-2.5 py-1 rounded-lg bg-[#140f21] border border-purple-900/40 text-stone-300 hover:text-rose-300 text-[11px] font-['Prompt',sans-serif] font-medium"
              title="กลับหน้าเริ่มแรก (Welcome Screen)"
            >
              หน้าแรก
            </button>
            <button
              onClick={onOpenMobileDrawer}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500/10 via-rose-500/15 to-purple-500/10 hover:bg-stone-850 border border-rose-500/40 text-rose-300 font-bold text-xs shrink-0 cursor-pointer shadow-sm transition-all"
              title="เมนูและการตั้งค่า"
            >
              <Menu className="w-4 h-4" />
              <span className="text-[11px] font-['Prompt',sans-serif]">เมนู</span>
              {currentUser && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="relative flex-1 max-w-[170px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาบาน..."
              className="w-full bg-[#120f1d] border border-purple-900/30 text-stone-100 text-xs pl-8 pr-6 py-1.5 rounded-xl focus:outline-none focus:border-rose-400 placeholder-stone-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center p-0.5 bg-[#120f1d] rounded-xl border border-purple-900/30 text-[11px] shrink-0 font-medium">
            {ZOOM_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setZoomLevel(option.id)}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap font-['Prompt',sans-serif] ${zoomLevel === option.id ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-500 text-white font-semibold shadow-xs' : 'text-stone-400 hover:text-stone-200'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tablet & desktop */}
      <div className="hidden sm:flex max-w-7xl mx-auto flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToWelcome}
            className="flex items-center gap-3 cursor-pointer group text-left"
            title="คลิกเพื่อกลับสู่หน้าแรก 500 Windows to Thailand"
          >
            <div className="transition-transform duration-300 group-hover:scale-105">
              <KapsulepLogo size={42} showGlow />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="font-['Outfit',sans-serif] font-bold text-xl lg:text-2xl tracking-tight bg-gradient-to-r from-white via-rose-100 to-amber-200 bg-clip-text text-transparent">
                  500 Windows
                </span>
                <span className="font-['Outfit',sans-serif] font-extrabold text-sm lg:text-base bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent">
                  to Thailand
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                <span className="font-['Prompt',sans-serif] font-light text-stone-300">
                  {isThailandBoard ? '500 หน้าต่างสู่ประเทศไทย' : `500 หน้าต่าง${region.name}`}
                </span>
                <span className="text-stone-600">·</span>
                <span className="font-mono text-stone-400 text-[10px] flex items-center gap-1">
                  <span className="font-bold bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent font-['Outfit',sans-serif]">
                    Kapsulep.com
                  </span>
                </span>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={onBackToWelcome}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-[#140f21] hover:bg-[#1a142c] border border-purple-900/40 hover:border-rose-500/50 text-stone-300 hover:text-white text-xs sm:text-sm font-medium font-['Prompt',sans-serif] transition-all cursor-pointer shadow-sm"
            title="กลับไปที่หน้าแรกของระบบ (Welcome Screen)"
          >
            <LayoutGrid className="w-4 h-4 text-rose-400" />
            <span>หน้าแรก</span>
          </button>
          <button
            onClick={onOpenRegionMenu}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl transition-all cursor-pointer text-xs sm:text-sm font-semibold font-['Prompt',sans-serif] shadow-sm ${isThailandBoard ? 'bg-[#140f21] hover:bg-[#1c162e] text-stone-200 border border-purple-500/40 hover:border-rose-400' : 'bg-purple-950/70 hover:bg-purple-900 text-purple-200 border border-purple-400/70 shadow-purple-950/50'}`}
            title="เลือกดูหน้าต่างประเทศไทย หรือแยกตามแต่ละภูมิภาค"
          >
            <span className="text-base">{region.icon}</span>
            <span>{isThailandBoard ? 'ภูมิภาค' : region.name}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-950/80 text-rose-400 border border-rose-500/30">
              {region.codePrefix}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          </button>
          <button
            onClick={() => onOpenHub('rules')}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#140f21] hover:bg-[#1c162e] border border-purple-900/40 hover:border-rose-500/50 text-stone-200 hover:text-rose-300 font-medium font-['Prompt',sans-serif] transition-all cursor-pointer text-xs sm:text-sm shadow-sm"
            title="เปิด Hub รวมข้อมูล: กติกา 5 ข้อ, เงื่อนไข 2 บาน, ยืนยันตัวตน, ค้นหา, สถิติ"
          >
            <Compass className="w-4 h-4 text-rose-400" />
            <span>Hub รวมข้อมูล</span>
          </button>
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-[#007bff] hover:bg-[#0069d9] text-white font-semibold text-xs sm:text-sm cursor-pointer shadow-sm"
              title="เข้าสู่ระบบผู้ดูแล (Admin)"
            >
              <Gauge className="w-4 h-4" />
              <span>Admin</span>
            </button>
          )}

          <div className="relative">
            {currentUser ? (
              <button
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center gap-2 p-1 pl-2 sm:pl-2.5 pr-2 rounded-xl bg-[#140f21] hover:bg-[#1c162e] border border-rose-500/30 hover:border-rose-400/60 text-stone-200 transition-all cursor-pointer text-xs"
              >
                <div className="relative">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-full object-cover border border-purple-500/50"
                  />
                  {currentUser.isVerified ? (
                    <span
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border border-stone-900 flex items-center justify-center text-[8px] text-white"
                      title="ยืนยันตัวตน (KYC) สำเร็จแล้ว"
                    >
                      ✓
                    </span>
                  ) : (
                    <span
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border border-stone-900 flex items-center justify-center text-[8px] text-white font-bold"
                      title="ยังไม่ยืนยันตัวตน (KYC)"
                    >
                      !
                    </span>
                  )}
                </div>
                <div className="hidden lg:flex flex-col text-left font-mono">
                  <span className="text-xs font-bold text-stone-200 truncate max-w-[100px] font-['Prompt',sans-serif]">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-rose-400 font-bold">฿{currentUser.balance.toLocaleString()}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-['Prompt',sans-serif] font-semibold text-xs sm:text-sm cursor-pointer shadow-md transition-all"
              >
                <UserCheck className="w-4 h-4" />
                <span>เข้าสู่ระบบ</span>
              </button>
            )}

            {accountMenuOpen && currentUser && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAccountMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#120f1e] border border-purple-900/50 p-3 shadow-2xl z-40 space-y-2.5 text-xs animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#19142b] border border-purple-900/30">
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full object-cover border border-rose-400"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-stone-100 truncate font-['Prompt',sans-serif]">{currentUser.name}</span>
                        {currentUser.isVerified ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-mono">
                            KYC แล้ว
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-950 text-rose-300 border border-rose-500/50 font-mono">
                            รอ KYC
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5">{maskPhone(currentUser.phone)}</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#09080e] border border-stone-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-['Prompt',sans-serif]">
                      <span className="text-stone-400">โควตาถือครอง (สูงสุด 2 บาน):</span>
                      <strong className="text-rose-400 font-mono">{quota.totalCount}/2 บาน</strong>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono">
                      <span>• บานประเทศไทย: {quota.thailandCount}/1</span>
                      <span>• บานภูมิภาค: {quota.regionalCount}/1</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-orange-500/10 via-rose-500/15 to-purple-500/10 border border-rose-500/30">
                    <div className="flex items-center gap-1.5 text-stone-300">
                      <Wallet className="w-4 h-4 text-rose-400" />
                      <span className="font-['Prompt',sans-serif]">ยอดเงินในกระเป๋า:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-300 font-mono text-sm">฿{currentUser.balance.toLocaleString()}</span>
                      {onOpenTopUp && (
                        <button
                          onClick={() => {
                            setAccountMenuOpen(false)
                            onOpenTopUp()
                          }}
                          className="px-2 py-0.5 rounded-lg bg-amber-400 text-stone-950 text-[11px] font-bold cursor-pointer"
                        >
                          + เติมเงิน
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAccountMenuOpen(false)
                      onOpenWalletHistory()
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl bg-[#09080e] border border-stone-800 hover:border-amber-500/50 text-[11px] text-amber-300 cursor-pointer font-['Prompt',sans-serif]"
                  >
                    <span className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" /> ประวัติการเงิน (เติมเงิน / ตัดเงิน)
                    </span>
                    <span>›</span>
                  </button>

                  {!currentUser.isVerified && (
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false)
                        onOpenKyc()
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white font-['Prompt',sans-serif] font-bold text-xs shadow cursor-pointer hover:opacity-95"
                    >
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>ยืนยันตัวตน (KYC) ด่วน</span>
                      </div>
                      <span className="text-[10px] underline">คลิก</span>
                    </button>
                  )}

                  <div className="pt-1 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-['Prompt',sans-serif]">
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false)
                        onOpenProfile()
                      }}
                      className="flex items-center gap-1 text-amber-300 hover:text-amber-200 cursor-pointer font-medium"
                    >
                      <UserCog className="w-3.5 h-3.5" />
                      <span>ข้อมูลส่วนตัว</span>
                    </button>
                    <div className="flex items-center gap-3">
                      {onOpenAdmin && (
                        <button
                          onClick={() => {
                            setAccountMenuOpen(false)
                            onOpenAdmin()
                          }}
                          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 cursor-pointer font-medium"
                        >
                          <Gauge className="w-3.5 h-3.5" />
                          <span>Admin</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setAccountMenuOpen(false)
                          onLogout()
                        }}
                        className="flex items-center gap-1 text-rose-400 hover:text-rose-300 cursor-pointer font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>ออกจากระบบ</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
