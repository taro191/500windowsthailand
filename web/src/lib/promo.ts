// Promo area on the board (windows 481–486): ad placement per 6-hour round, the promo
// dialog preview, and the active ads / booking data loaded from the API.
import { seededRandom } from '@shared/random'
import { sixHourBlockIndex } from '@shared/thaiTime'
import { PROMO_LAYOUTS, PROMO_SLOTS, roundsLeft, safeHttpUrl, type PromoAd, type PromoLayout, type PromoRequest } from '@shared/promo'

export * from '@shared/promo'

/** Window event that opens the promo request dialog from anywhere. */
export const OPEN_PROMO_EVENT = 'kapsulep:open-promo'

/** `YYYY-MM-DD` in the browser's local time zone. */
export function localDateKey(date: Date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/** A real calendar date, today or later. */
export function isValidPromoStartDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return Number.isFinite(date.getTime()) && localDateKey(date) === value && value >= localDateKey()
}

/** Settings editable in index.html without a rebuild (`window.KAPSULEP_CONFIG`). */
interface KapsulepConfig {
  promoEmail?: string
  promoLineUrl?: string
  promoAds?: PromoAd[]
}

declare global {
  interface Window {
    KAPSULEP_CONFIG?: KapsulepConfig
  }
}

const getConfig = (): KapsulepConfig => window.KAPSULEP_CONFIG || {}
export const getPromoEmail = () => (getConfig().promoEmail || '').trim()
export const getPromoLineUrl = () => safeHttpUrl(getConfig().promoLineUrl)

// Loaded from the API by store.ts (see setPromoData).
let activeAds: PromoAd[] = []
let myRequests: PromoRequest[] = []
/** Rounds already booked per start date (YYYY-MM-DD) by non-rejected requests. */
let reservedRounds: Record<string, number> = {}

export function setPromoData(data: { ads?: PromoAd[]; myRequests?: PromoRequest[]; reservedRounds?: Record<string, number> }) {
  if (data.ads) activeAds = data.ads
  if (data.myRequests) myRequests = data.myRequests
  if (data.reservedRounds) reservedRounds = data.reservedRounds
}

/** The signed-in user's promo requests, newest first. */
export const loadPromoRequests = (): PromoRequest[] => myRequests

/** Rounds still free on `date` (4 per day minus booked rounds). */
export const promoRoundsAvailable = (date: string) => roundsLeft(reservedRounds[date] || 0)

/** Approved ads from the API plus any configured in index.html. */
export function getActiveAds(): PromoAd[] {
  const configured = Array.isArray(getConfig().promoAds) ? getConfig().promoAds! : []
  return [...configured, ...activeAds]
}

/** Downscales an uploaded image to a JPEG data URL no larger than `maxSize` px. */
export function resizeImageFile(file: File, maxSize = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('img'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

type Cell = [row: number, col: number]

/**
 * Example placement of a `size`-window ad on a 6×8 mini board, for the promo dialog
 * preview. `variant` and `salt` pick a different random example.
 */
export function previewPromoLayout(size: number, variant: number, salt = 0, nums?: number[]) {
  const random = seededRandom(variant * 7919 + size * 104729 + salt)
  const layout = PROMO_LAYOUTS[Math.floor(random() * 4)]
  const numbers =
    nums ??
    PROMO_SLOTS.slice()
      .sort(() => random() - 0.5)
      .slice(0, size)
      .sort((a, b) => a - b)
  const pick = (n: number) => Math.floor(random() * n)
  let cells: Cell[] = []

  if (layout === 'horizontal') {
    const row = pick(6)
    const col = pick(8 - size + 1)
    cells = numbers.map((_, i) => [row, col + i])
  } else if (layout === 'vertical') {
    const row = pick(6 - size + 1)
    const col = pick(8)
    cells = numbers.map((_, i) => [row + i, col])
  } else if (layout === 'cluster') {
    const width = size === 2 ? 2 : size === 6 ? 3 : 2
    const height = size === 2 ? 1 : 2
    const row = pick(6 - height + 1)
    const col = pick(8 - width + 1)
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) cells.push([row + r, col + c])
    cells = cells.slice(0, size)
  } else {
    for (let attempt = 0; cells.length < size && attempt < 400; attempt++) {
      const cell: Cell = [pick(6), pick(8)]
      if (cells.every((c) => Math.abs(c[0] - cell[0]) + Math.abs(c[1] - cell[1]) > 2)) cells.push(cell)
    }
    while (cells.length < size) cells.push([cells.length % 6, (cells.length * 3) % 8])
  }
  return { layout, cells: cells.map(([r, c], i) => ({ r, c, num: numbers[i] })) }
}

function layoutForRound(round: number, index: number): PromoLayout {
  return PROMO_LAYOUTS[Math.floor(seededRandom(round * 977 + index * 31 + 5)() * 4)]
}

/** Assigns active ads to promo window numbers for the 6-hour round containing `time`. */
export function assignAdsToSlots(time = Date.now()) {
  const round = sixHourBlockIndex(time)
  const random = seededRandom(round * 131 + 7)
  const freeNumbers = PROMO_SLOTS.slice().sort(() => random() - 0.5)
  const placed: { ad: PromoAd; nums: number[]; layout: PromoLayout }[] = []
  for (const ad of getActiveAds()) {
    const size = Math.min(6, Math.max(1, ad.size))
    if (freeNumbers.length < size) continue
    const nums = freeNumbers.splice(0, size).sort((a, b) => a - b)
    placed.push({ ad, nums, layout: layoutForRound(round, placed.length) })
  }
  return placed
}

export function adForSlot(id: number): PromoAd | null {
  for (const group of assignAdsToSlots()) if (group.nums.includes(id)) return group.ad
  return null
}

/** Ad groups plus one group for the still-empty promo windows. */
function promoGroups(time = Date.now()) {
  const round = sixHourBlockIndex(time)
  const placed = assignAdsToSlots(time)
  const used = new Set(placed.flatMap((g) => g.nums))
  const empty = PROMO_SLOTS.filter((n) => !used.has(n))
  const groups = placed.map((g) => ({ nums: g.nums, layout: g.layout }))
  if (empty.length) groups.push({ nums: empty, layout: layoutForRound(round, groups.length) })
  return groups
}

function placeGroup(layout: PromoLayout, count: number, cols: number, rows: number, random: () => number): Cell[] {
  const pick = (n: number) => Math.floor(random() * Math.max(1, n))
  const cells: Cell[] = []
  if (layout === 'horizontal' && count <= cols) {
    const row = pick(rows)
    const col = pick(cols - count + 1)
    for (let i = 0; i < count; i++) cells.push([row, col + i])
  } else if (layout === 'vertical') {
    const row = pick(rows - count + 1)
    const col = pick(cols)
    for (let i = 0; i < count; i++) cells.push([row + i, col])
  } else if (layout === 'scatter') {
    for (let attempt = 0; cells.length < count && attempt < 200; attempt++) {
      const cell: Cell = [pick(rows), pick(cols)]
      if (cells.every((c) => Math.abs(c[0] - cell[0]) + Math.abs(c[1] - cell[1]) > 2)) cells.push(cell)
    }
  } else {
    const width = Math.min(cols, count <= 2 ? count : count <= 4 ? 2 : 3)
    const row = pick(rows - Math.ceil(count / width) + 1)
    const col = pick(cols - width + 1)
    for (let i = 0; i < count; i++) cells.push([row + Math.floor(i / width), col + (i % width)])
  }
  return cells
}

/**
 * Where each promo window number sits on a grid with `cols` columns and `total` cells
 * this round. Returns promo number → grid index.
 */
export function promoGridPositions(cols: number, total: number, time = Date.now()): Map<number, number> {
  const round = sixHourBlockIndex(time)
  const rows = Math.ceil(total / cols)
  const random = seededRandom(round * 4099 + cols)
  const taken = new Set<number>()
  const positions = new Map<number, number>()
  const isFree = (r: number, c: number) =>
    r >= 0 && c >= 0 && c < cols && r < rows && r * cols + c < total && !taken.has(r * cols + c)

  for (const group of promoGroups(time)) {
    const count = group.nums.length
    let cells: Cell[] = []
    for (let attempt = 0; attempt < 300; attempt++) {
      const candidate = placeGroup(group.layout, count, cols, rows, random)
      if (candidate.length === count && candidate.every(([r, c]) => isFree(r, c))) {
        cells = candidate
        break
      }
    }
    // Fall back to the last free cells of the grid.
    for (let index = total - 1; cells.length < count && index >= 0; index--) {
      if (!taken.has(index)) cells.push([Math.floor(index / cols), index % cols])
    }
    cells.forEach(([r, c], i) => {
      const index = r * cols + c
      taken.add(index)
      positions.set(group.nums[i], index)
    })
  }
  return positions
}
