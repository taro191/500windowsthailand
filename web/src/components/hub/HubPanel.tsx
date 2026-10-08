import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ChartNoAxesColumn, Megaphone, Search, Wallet, X, type LucideIcon } from 'lucide-react'
import type {
  AuthMode,
  CategoryId,
  HubTab,
  PayoutAccount,
  RegionId,
  StatusFilter,
  Transaction,
  User,
  WindowItem,
} from '@shared/types'
import { REGIONS_BY_ID } from '@shared/regions'
import { isPromoSlot, OPEN_PROMO_EVENT } from '@/lib/promo'
import { KapsulepLogo } from '../KapsulepLogo'
import { PromoRequestModal } from '../promo/PromoRequestModal'
import { RulesTab } from './RulesTab'
import { SearchFilterTab, type BoardCounts } from './SearchFilterTab'
import { WalletTab } from './WalletTab'
import { StatsTab } from './StatsTab'

interface HubPanelProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: HubTab
  currentUser: User | null
  myWindows: WindowItem[]
  transactions: Transaction[]
  activeRegion: RegionId
  /** All windows of the active region. */
  windows: WindowItem[]
  statusFilter: StatusFilter
  setStatusFilter: (filter: StatusFilter) => void
  categoryFilter: CategoryId | 'all'
  setCategoryFilter: (category: CategoryId | 'all') => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  jumpNumber: string
  setJumpNumber: (value: string) => void
  onJumpToWindow: (windowNumber: number) => void
  onSelectWindow: (window: WindowItem) => void
  onOpenTopUp?: () => void
  onUpdateUserName: (name: string) => void
  onUpdatePayoutAccount: (account: PayoutAccount) => void
  onRotateWindows: (forceRandom: boolean) => void
  onOpenAuth: (mode: AuthMode) => void
  followCount: number
  /** A promo request was paid: refresh the wallet balance. */
  onUserUpdated: (user: User) => void
}

const TABS: [HubTab, LucideIcon, string][] = [
  ['rules', BookOpen, 'กติกา'],
  ['filter', Search, 'ค้นหา'],
  ['wallet', Wallet, 'บัญชี'],
  ['stats', ChartNoAxesColumn, 'สถิติ'],
]

/** Side drawer: rules, search & filters, wallet, statistics — plus the promo request dialog. */
export function HubPanel(props: HubPanelProps) {
  const { isOpen, onClose, initialTab = 'rules', currentUser, myWindows, activeRegion, windows } = props
  const [tab, setTab] = useState<HubTab>(initialTab)
  const [promoOpen, setPromoOpen] = useState(false)
  const closePromo = useCallback(() => setPromoOpen(false), [])

  // Any part of the app can open the promo dialog by dispatching OPEN_PROMO_EVENT.
  useEffect(() => {
    const open = () => setPromoOpen(true)
    window.addEventListener(OPEN_PROMO_EVENT, open)
    return () => window.removeEventListener(OPEN_PROMO_EVENT, open)
  }, [])

  useEffect(() => {
    if (isOpen && initialTab) setTab(initialTab)
  }, [isOpen, initialTab])

  const region = REGIONS_BY_ID[activeRegion]
  const counts: BoardCounts = {
    total: windows.length,
    available: windows.filter((w) => w.status === 'available' && !isPromoSlot(w.id)).length,
    forResale: windows.filter((w) => w.status === 'for_resale').length,
    occupied: windows.filter((w) => w.status === 'occupied').length,
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200 font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
          <div
            className="w-full max-w-lg bg-[#0e0b17] border-l border-purple-900/40 h-full flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 bg-[#09080e]">
              <div className="flex items-center gap-3.5">
                <KapsulepLogo size={38} showGlow />
                <div>
                  <h2 className="font-['Prompt',sans-serif] text-lg font-semibold leading-tight text-stone-50">Hub-ระบบจัดการ</h2>
                  <p className="font-['Prompt',sans-serif] text-xs font-light text-stone-400">
                    กติกา การค้นหา กระเป๋าเงิน และสถิติ ในที่เดียว
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPromoOpen(true)}
                  aria-label="โปรโมท"
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-fuchsia-500 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity font-['Prompt',sans-serif] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
                >
                  <Megaphone className="h-4 w-4" />
                  <span className="hidden min-[420px]:inline">โปรโมท</span>
                </button>
                <button
                  onClick={onClose}
                  aria-label="ปิด"
                  className="p-2 text-stone-400 hover:text-stone-100 hover:bg-[#1a142c] rounded-xl cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              role="tablist"
              className="grid grid-cols-4 gap-1.5 px-3 pb-3 bg-[#09080e] border-b border-purple-900/30 font-['Prompt',sans-serif]"
            >
              {TABS.map(([id, Icon, label]) => {
                const active = tab === id
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(id)}
                    className={`relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] sm:text-xs transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 ${active ? 'bg-[#1c1432] text-rose-200 font-semibold ring-1 ring-rose-400/40' : 'text-stone-400 hover:text-stone-100 hover:bg-[#130f21]'}`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    <span className="text-center leading-tight">{label}</span>
                    {id === 'wallet' && myWindows.length > 0 && (
                      <span className="absolute right-2 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                        {myWindows.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {tab === 'rules' && <RulesTab onRotateWindows={props.onRotateWindows} />}
              {tab === 'filter' && (
                <SearchFilterTab
                  region={region}
                  counts={counts}
                  currentUser={currentUser}
                  followCount={props.followCount}
                  statusFilter={props.statusFilter}
                  setStatusFilter={props.setStatusFilter}
                  categoryFilter={props.categoryFilter}
                  setCategoryFilter={props.setCategoryFilter}
                  searchQuery={props.searchQuery}
                  setSearchQuery={props.setSearchQuery}
                  jumpNumber={props.jumpNumber}
                  setJumpNumber={props.setJumpNumber}
                  onJumpToWindow={props.onJumpToWindow}
                  onClose={onClose}
                />
              )}
              {tab === 'wallet' && (
                <WalletTab
                  currentUser={currentUser}
                  myWindows={myWindows}
                  transactions={props.transactions}
                  onOpenTopUp={props.onOpenTopUp}
                  onUpdateUserName={props.onUpdateUserName}
                  onUpdatePayoutAccount={props.onUpdatePayoutAccount}
                  onSelectWindow={props.onSelectWindow}
                  onOpenAuth={props.onOpenAuth}
                  onClose={onClose}
                />
              )}
              {tab === 'stats' && <StatsTab region={region} counts={counts} transactions={props.transactions} />}
            </div>
          </div>
        </div>
      )}
      <PromoRequestModal
        isOpen={promoOpen}
        onClose={closePromo}
        currentUser={currentUser}
        onOpenAuth={props.onOpenAuth}
        onPaid={props.onUserUpdated}
      />
    </>
  )
}
