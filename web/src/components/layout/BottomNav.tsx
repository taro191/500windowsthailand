import type { LucideIcon } from 'lucide-react'
import { Bell, House, Map as MapIcon, Megaphone, UserRound } from 'lucide-react'
import type { User } from '@shared/types'

interface BottomNavProps {
  currentUser: User | null
  /** Board is showing the cross-region "following" view. */
  showingFollow: boolean
  followCount: number
  onHome: () => void
  onOpenRegionMenu: () => void
  onOpenPromo: () => void
  onShowFollowing: () => void
  onOpenProfile: () => void
}

/** Phone-only tab bar fixed to the bottom of the board; each tab reuses an existing dialog or filter. */
export function BottomNav(props: BottomNavProps) {
  const { currentUser, showingFollow, followCount } = props
  const items: { label: string; icon: LucideIcon; onClick: () => void; active?: boolean; badge?: number }[] = [
    { label: 'หน้าหลัก', icon: House, onClick: props.onHome, active: !showingFollow },
    { label: 'ภูมิภาค', icon: MapIcon, onClick: props.onOpenRegionMenu },
    { label: 'โปรโมท', icon: Megaphone, onClick: props.onOpenPromo },
    { label: 'ติดตาม', icon: Bell, onClick: props.onShowFollowing, active: showingFollow, badge: currentUser ? followCount : 0 },
    { label: 'โปรไฟล์', icon: UserRound, onClick: props.onOpenProfile },
  ]

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#09080e]/95 backdrop-blur-md border-t border-purple-900/40 shadow-2xl pb-[env(safe-area-inset-bottom)] font-['Prompt',sans-serif]">
      <div className="grid grid-cols-5">
        {items.map(({ label, icon: Icon, onClick, active, badge }) => (
          <button
            key={label}
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] cursor-pointer transition-colors ${active ? 'text-rose-300 font-semibold' : 'text-stone-400 hover:text-stone-200'}`}
          >
            {active && <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-gradient-to-r from-orange-400 via-rose-500 to-purple-600" />}
            <span className="relative">
              {label === 'โปรไฟล์' && currentUser ? (
                <img src={currentUser.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-amber-400" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
              {!!badge && (
                <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold leading-4 text-center font-mono">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
