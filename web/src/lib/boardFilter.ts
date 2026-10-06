import type { CategoryId, StatusFilter, User, WindowItem } from '@/types'
import { matchesEffectFilter } from './windowBadges'

/** Applies the status/effect filter, category and free-text search used by the board. */
export function filterWindows(
  windows: WindowItem[],
  { status, category, query, user }: { status: StatusFilter; category: CategoryId | 'all'; query: string; user: User | null },
): WindowItem[] {
  const q = query.toLowerCase().trim()
  return windows.filter((w) => {
    if (status === 'my') {
      if (!user || w.ownerId !== user.id) return false
    } else if (status === 'follow') {
      if (!user || !w.followerIds?.includes(user.id)) return false
    } else if (status.startsWith('fx_')) {
      if (!matchesEffectFilter(w, status)) return false
    } else if (status !== 'all' && w.status !== status) {
      return false
    }

    if (category !== 'all' && w.category !== category) return false

    if (q) {
      const matchesNumber = w.id.toString() === q || `#${w.id}` === q || w.code.toLowerCase().includes(q)
      const matchesText =
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.ownerName.toLowerCase().includes(q) ||
        !!w.province?.toLowerCase().includes(q)
      if (!matchesNumber && !matchesText) return false
    }
    return true
  })
}
