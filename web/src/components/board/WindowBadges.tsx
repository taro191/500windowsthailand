// Visual effects layered on a window tile: star (popular), sparks (very hot) and the highlight pill.
import type { WindowItem } from '@/types'
import { freshKind, highlightKind, hotLevel, likesToday, starLevel, todaysNote } from '@/lib/windowBadges'

const STAR_PATH = 'M12 2.2l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17l-6 3.3 1.3-6.6L2.4 9.1l6.7-.8L12 2.2z'

export const STAR_LABELS: Record<1 | 2 | 3, string> = {
  1: 'ดาวส้ม-คอรัล',
  2: 'ดาวรัศมีม่วง-ชมพู',
  3: 'ดาวเพชร',
}

const STAR_COLORS: Record<1 | 2 | 3, [string, string, string]> = {
  1: ['#fed7aa', '#f97316', '#f43f5e'],
  2: ['#fde68a', '#fb7185', '#d946ef'],
  3: ['#ffffff', '#67e8f9', '#0ea5e9'],
}

interface StarBadgeProps {
  windowItem: WindowItem
  size?: number
  className?: string
}

/** ⭐ shown when likes or followers reach 1,000 / 5,000 / 10,000. */
export function StarBadge({ windowItem, size = 14, className = '' }: StarBadgeProps) {
  const level = starLevel(windowItem)
  if (!level) return null
  const gradientId = `star-${windowItem.region}-${windowItem.id}`
  const [from, via, to] = STAR_COLORS[level]
  const label = STAR_LABELS[level]
  const levelClass = level === 2 ? 'fx-star-2' : level === 3 ? 'fx-star-3' : ''

  return (
    <span className={`fx-star ${levelClass} ${className}`} title={`${label} · ยอดนิยมสูง`}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label={label}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="0.5" stopColor={via} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <path d={STAR_PATH} fill={`url(#${gradientId})`} stroke="rgba(0,0,0,.35)" strokeWidth="0.6" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/** Rising sparks for windows with 50+ likes today. */
export function HotSparks({ windowItem }: { windowItem: WindowItem }) {
  if (hotLevel(windowItem) < 2) return null
  return (
    <>
      <span className="fx-spark" style={{ left: '18%', animationDelay: '0s' }}>✨</span>
      <span className="fx-spark" style={{ left: '48%', animationDelay: '0.7s' }}>🔥</span>
      <span className="fx-spark" style={{ left: '76%', animationDelay: '1.4s' }}>✨</span>
    </>
  )
}

/** Bottom-right pill: 🔥 hot, ✨ new / 🤝 new owner, or 🟢 updated today. */
export function HighlightPill({ windowItem, compact = false }: { windowItem: WindowItem; compact?: boolean }) {
  const kind = highlightKind(windowItem)
  if (!kind) return null
  const base = compact
    ? 'absolute bottom-0.5 right-0.5 z-[6] px-1 py-0.2 rounded text-[8px] font-bold leading-tight flex items-center gap-0.5 shadow'
    : 'absolute bottom-2 right-2 z-[6] px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 shadow-md'

  if (kind === 'hot') {
    return (
      <span className={`${base} bg-gradient-to-r from-orange-500 to-rose-500 text-white font-mono font-bold shadow-sm`}>
        <span>🔥</span>
        {!compact && (
          <span>
            {hotLevel(windowItem) === 2 ? 'ฮอตมาก' : 'ฮอตวันนี้'} · {likesToday(windowItem)}
          </span>
        )}
      </span>
    )
  }

  if (kind === 'fresh') {
    const newOwner = freshKind(windowItem) === 'owner'
    return (
      <span className={`${base} bg-gradient-to-r from-rose-500 to-purple-600 text-white font-bold shadow-sm`}>
        <span>{newOwner ? '🤝' : '✨'}</span>
        <span>{compact ? (newOwner ? 'ใหม่' : 'NEW') : newOwner ? 'เจ้าของใหม่' : 'เปิดใหม่'}</span>
      </span>
    )
  }

  return (
    <span
      className={`${base} bg-stone-950/90 text-emerald-300 border border-emerald-500/60`}
      title={todaysNote(windowItem) || 'อัปเดตวันนี้'}
    >
      <span className="fx-dot" />
      {!compact && <span>อัปเดตวันนี้</span>}
    </span>
  )
}
