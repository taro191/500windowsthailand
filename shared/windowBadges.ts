// Display effects on the board: 🔥 hot, ✨ new / 🤝 new owner, 🟢 updated today, ⭐ popular.
import type { StatusFilter, WindowItem } from './types'
import { thaiDayKey } from './thaiTime'

export const HOT_LIKES_TODAY = 10
export const VERY_HOT_LIKES_TODAY = 50
export const FRESH_WINDOW_HOURS = 72

export type HighlightKind = 'hot' | 'fresh' | 'daily'

export function likesToday(window: WindowItem): number {
  return window.dailyLikes && window.dailyLikes.day === thaiDayKey() ? window.dailyLikes.count : 0
}

/** 0 = not hot, 1 = hot (≥10 likes today), 2 = very hot (≥50 likes today). */
export function hotLevel(window: WindowItem): 0 | 1 | 2 {
  if (window.status === 'available') return 0
  const likes = likesToday(window)
  if (likes >= VERY_HOT_LIKES_TODAY) return 2
  return likes >= HOT_LIKES_TODAY ? 1 : 0
}

/** Within 72 hours of a first claim (`new`) or a change of owner (`owner`). */
export function freshKind(window: WindowItem): 'new' | 'owner' | null {
  if (window.status === 'available' || !window.ownerChangedAt) return null
  const hoursSince = (Date.now() - new Date(window.ownerChangedAt).getTime()) / 3_600_000
  if (hoursSince < 0 || hoursSince > FRESH_WINDOW_HOURS) return null
  return window.ownerChangeKind === 'owner' ? 'owner' : 'new'
}

export function todaysNote(window: WindowItem): string | null {
  return window.dailyNote && window.dailyNote.day === thaiDayKey() ? window.dailyNote.text : null
}

export function isUpdatedToday(window: WindowItem): boolean {
  if (window.status === 'available') return false
  if (todaysNote(window)) return true
  return window.lastImageUpdatedAt ? thaiDayKey(new Date(window.lastImageUpdatedAt)) === thaiDayKey() : false
}

export function followerCount(window: WindowItem): number {
  return (window.followersBase || 0) + (window.followerIds?.length || 0)
}

/** 0 = none, 1 = ≥1,000, 2 = ≥5,000, 3 = ≥10,000 likes or followers. */
export function starLevel(window: WindowItem): 0 | 1 | 2 | 3 {
  if (window.status === 'available') return 0
  const score = Math.max(window.likesCount, followerCount(window))
  if (score >= 10000) return 3
  if (score >= 5000) return 2
  return score >= 1000 ? 1 : 0
}

/** The single strongest highlight, in priority order hot → fresh → daily. */
export function highlightKind(window: WindowItem): HighlightKind | null {
  if (hotLevel(window) > 0) return 'hot'
  if (freshKind(window)) return 'fresh'
  if (isUpdatedToday(window)) return 'daily'
  return null
}

export function highlightLabel(window: WindowItem): string | null {
  switch (highlightKind(window)) {
    case 'hot':
      return `ฮอตวันนี้ (${likesToday(window)} ไลค์)`
    case 'fresh':
      return freshKind(window) === 'owner' ? 'เจ้าของใหม่' : 'เปิดใหม่'
    case 'daily':
      return 'อัปเดตวันนี้'
    default:
      return null
  }
}

/** CSS effect classes (see index.css) for a window's tile border. */
export function highlightClass(window: WindowItem): string {
  switch (highlightKind(window)) {
    case 'hot':
      return hotLevel(window) === 2 ? 'fx-hot fx-hot-2' : 'fx-hot'
    case 'fresh':
      return 'fx-fresh'
    case 'daily':
      return 'fx-daily'
    default:
      return ''
  }
}

export function matchesEffectFilter(window: WindowItem, filter: StatusFilter): boolean {
  switch (filter) {
    case 'fx_hot':
      return hotLevel(window) > 0
    case 'fx_new':
      return !!freshKind(window)
    case 'fx_daily':
      return isUpdatedToday(window)
    case 'fx_star':
      return starLevel(window) > 0
    default:
      return true
  }
}
