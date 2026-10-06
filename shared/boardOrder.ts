import type { RegionId, WindowItem } from './types'
import { shuffledIndices } from './random'
import { isPromoSlot } from './promo'

/**
 * Orders a region's windows for the given rotation cycle and stamps each with its
 * `slotPosition`. Standard cycles (1/15/25) keep the 1–500 order; other cycles get a
 * deterministic shuffle so every visitor sees the same board. Promo slots 481–486
 * never move. `forceRandom` reshuffles immediately (simulation button in the Hub).
 */
export function orderWindowsForCycle(
  regionId: RegionId,
  windows: WindowItem[],
  cycleKey: string,
  forceRandom = false,
): WindowItem[] {
  if (!windows || windows.length === 0) return windows
  const byId = windows.slice().sort((a, b) => a.id - b.id)
  const total = byId.length

  if (!forceRandom && cycleKey.endsWith('-standard')) {
    return byId.map((w, index) => ({ ...w, slotPosition: index + 1 }))
  }

  const pinned = byId.filter((w) => isPromoSlot(w.id) && w.id <= total)
  const movable = byId.filter((w) => !pinned.includes(w))
  const seed = forceRandom ? `random_${Date.now()}_${regionId}` : `rotation_${regionId}_${cycleKey}`
  const order = shuffledIndices(movable.length, seed)

  const slots: WindowItem[] = new Array(total)
  pinned.forEach((w) => {
    slots[w.id - 1] = { ...w, slotPosition: w.id }
  })
  let next = 0
  for (let i = 0; i < total; i++) {
    if (!slots[i]) slots[i] = { ...movable[order[next++]], slotPosition: i + 1 }
  }
  return slots
}
