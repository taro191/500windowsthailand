// Promo area: windows 481–486 are reserved for sponsored ads. Pricing, request shape and
// booking limits are shared by the web app and the API; board placement lives in the web app.

import { sixHourBlockIndex } from './thaiTime'

export const PROMO_SLOTS = [481, 482, 483, 484, 485, 486]
export const PROMO_SIZES = [2, 3, 4, 6]

export const isPromoSlot = (id: number) => id >= 481 && id <= 486

export type PromoLayout = 'horizontal' | 'vertical' | 'cluster' | 'scatter'
export const PROMO_LAYOUTS: PromoLayout[] = ['horizontal', 'vertical', 'cluster', 'scatter']
export const PROMO_LAYOUT_LABELS: Record<PromoLayout, string> = {
  horizontal: 'แถวแนวนอน',
  vertical: 'แถวแนวตั้ง',
  cluster: 'กลุ่มก้อน',
  scatter: 'แยกสุ่ม',
}
/** Layouts the promoter picks from; ads without one (older requests) get a random layout each round. */
export const PROMO_CHOOSABLE_LAYOUTS: PromoLayout[] = ['horizontal', 'vertical', 'cluster', 'scatter']
export const isChoosableLayout = (value: unknown): value is PromoLayout => PROMO_CHOOSABLE_LAYOUTS.includes(value as PromoLayout)

/** Optional extras for the promo page viewers open from the board; every field may be empty. */
export interface PromoDetails {
  /** Occupation or kind of business, e.g. "คาเฟ่และร้านกาแฟ". */
  role: string
  /** Main offer, e.g. "ซื้อ 1 แถม 1". */
  offer: string
  offerNote: string
  price: string
  oldPrice: string
  /** `YYYY-MM-DD`. */
  validFrom: string
  validTo: string
  hours: string
  area: string
  address: string
  mapUrl: string
  /** LINE ID ("@shop") or an https link. */
  line: string
  links: { label: string; url: string }[]
  points: string[]
  /** Label of the button built from LINE / map / first link. */
  ctaLabel: string
  termsTitle: string
  terms: string[]
}

export const PROMO_DETAIL_LIMITS = { text: 120, links: 3, points: 6, terms: 8, line: 200 }

export const emptyPromoDetails = (): PromoDetails => ({
  role: '',
  offer: '',
  offerNote: '',
  price: '',
  oldPrice: '',
  validFrom: '',
  validTo: '',
  hours: '',
  area: '',
  address: '',
  mapUrl: '',
  line: '',
  links: [],
  points: [],
  ctaLabel: '',
  termsTitle: '',
  terms: [],
})

/** Trims and limits the extras and checks links and dates; returns the first problem in Thai. */
export function cleanPromoDetails(input: Partial<PromoDetails> | null | undefined): { details: PromoDetails; error?: string } {
  const raw = input ?? {}
  const L = PROMO_DETAIL_LIMITS
  const text = (value: unknown, max = L.text) => String(value ?? '').trim().slice(0, max)
  const lines = (value: unknown, count: number) =>
    (Array.isArray(value) ? value : [])
      .map((v) => text(v, L.line))
      .filter(Boolean)
      .slice(0, count)
  const details: PromoDetails = {
    role: text(raw.role),
    offer: text(raw.offer, 60),
    offerNote: text(raw.offerNote),
    price: text(raw.price, 40),
    oldPrice: text(raw.oldPrice, 40),
    validFrom: text(raw.validFrom, 10),
    validTo: text(raw.validTo, 10),
    hours: text(raw.hours),
    area: text(raw.area),
    address: text(raw.address, L.line),
    mapUrl: text(raw.mapUrl, 500),
    line: text(raw.line, 200),
    links: (Array.isArray(raw.links) ? raw.links : [])
      .map((k) => ({ label: text(k?.label, 24), url: text(k?.url, 500) }))
      .filter((k) => k.url)
      .slice(0, L.links),
    points: lines(raw.points, L.points),
    ctaLabel: text(raw.ctaLabel, 30),
    termsTitle: text(raw.termsTitle, 60),
    terms: lines(raw.terms, L.terms),
  }
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime())
  let error: string | undefined
  if ((details.validFrom && !isDate(details.validFrom)) || (details.validTo && !isDate(details.validTo))) error = 'วันที่ของโปรโมชันไม่ถูกต้อง'
  else if (details.validFrom && details.validTo && details.validFrom > details.validTo) error = 'วันเริ่มโปรโมชันต้องไม่เกินวันสิ้นสุด'
  else if (details.mapUrl && !safeHttpUrl(details.mapUrl)) error = 'ลิงก์แผนที่ต้องขึ้นต้นด้วย http:// หรือ https://'
  else if (details.links.some((k) => !safeHttpUrl(k.url))) error = 'ลิงก์เพิ่มเติมต้องขึ้นต้นด้วย http:// หรือ https://'
  else if (details.line && !safeHttpUrl(details.line) && !/^@?[\w.-]{2,40}$/.test(details.line)) error = 'LINE ต้องเป็น LINE ID (เช่น @shop) หรือลิงก์ https://'
  return { details, error }
}

export interface PromoAd {
  /** Request id; empty for ads configured in index.html. */
  id?: string
  brand: string
  tagline?: string
  link?: string
  contact?: string
  image?: string
  images?: string[]
  /** Number of windows the ad occupies (1–6). */
  size: number
  /** How its windows sit on the board; random each round when missing. */
  layout?: PromoLayout
  details?: PromoDetails
  /** Booked rounds as 6-hour block indexes (`to` exclusive); missing = always shown (index.html ads). */
  fromRound?: number
  toRound?: number
}

export const PROMO_PRICE_PER_WINDOW_ROUND = 30
export const PROMO_ROUND_OPTIONS = [1, 2, 3, 4]
/** Each day has four 6-hour rounds that can be booked. */
export const PROMO_ROUNDS_PER_DAY = 4
export const PROMO_MAX_IMAGES = 6

export type PromoRequestStatus = 'pending' | 'approved' | 'rejected'

export interface PromoRequest {
  id: string
  userId: string
  brand: string
  tagline: string
  link: string
  contact: string
  images: string[]
  /** First image, used by the ad renderer on the board. */
  image: string
  details: PromoDetails
  /** Chosen layout; missing on requests made before layouts could be chosen. */
  layout?: PromoLayout
  size: number
  price: number
  rounds: number
  durationHours: number
  scheduleMode: 'today' | 'calendar'
  /** Local date `YYYY-MM-DD`. */
  startDate: string
  termsAccepted: true
  termsAcceptedAt: string
  createdAt: string
  status: PromoRequestStatus
  /** Requests saved by older versions used whole days instead of rounds. */
  duration?: number
  /** Paid when the request is submitted. */
  payment?: {
    amount: number
    walletAmount: number
    externalAmount: number
    channelName?: string
    slipRef?: string
    paidAt: string
    transactionId?: string
    /** Payment order; `pending` while the transfer slip waits for an admin. */
    orderId?: string
    orderStatus?: 'pending' | 'approved' | 'rejected'
  }
  /** Set when an admin rejects a paid request: the amount goes back to the wallet. */
  refund?: {
    amount: number
    at: string
    transactionId: string
  }
  decidedAt?: string
  /** Shown to the requester when the request is rejected. */
  decisionNote?: string
}

/** Price of `size` windows for `rounds` rounds; the per-window price comes from settings.rules. */
export const promoPrice = (size: number, rounds: number, perWindowRound = PROMO_PRICE_PER_WINDOW_ROUND) => size * rounds * perWindowRound

/** Rounds still free on `date`, given the rounds already reserved that day. */
export const roundsLeft = (reserved: number) => Math.max(0, PROMO_ROUNDS_PER_DAY - reserved)

/** Only http(s) or inline image data; anything else becomes ''. */
export const safeImageUrl = (url?: string) => (url && /^(https?:\/\/|data:image\/|\/uploads\/)/i.test(url) ? url : '')
export const safeHttpUrl = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : '')

/** Index of the first 6-hour round (00:00–06:00 Thai time) of `date` (`YYYY-MM-DD`). */
export const firstRoundOfDay = (date: string) => sixHourBlockIndex(Date.parse(`${date}T00:00:00+07:00`))

export interface BookedPromo {
  id: string
  startDate: string
  rounds: number
  createdAt: string
}

/**
 * Which rounds each booking gets: a day's four rounds go to its bookings in the order they
 * were made, one booking per round, never earlier than the round the booking was made in.
 * `to` is exclusive; a booking squeezed out of its day gets `from === to`.
 */
export function schedulePromoRounds(bookings: BookedPromo[]) {
  const schedule = new Map<string, { from: number; to: number }>()
  const nextFree = new Map<string, number>()
  for (const b of [...bookings].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    const dayStart = firstRoundOfDay(b.startDate)
    const dayEnd = dayStart + PROMO_ROUNDS_PER_DAY
    const from = Math.min(dayEnd, Math.max(nextFree.get(b.startDate) ?? dayStart, sixHourBlockIndex(Date.parse(b.createdAt))))
    const to = Math.min(dayEnd, from + b.rounds)
    schedule.set(b.id, { from, to })
    nextFree.set(b.startDate, to)
  }
  return { schedule, nextFree }
}

/** Rounds of `date` that can still be booked: after the last booked round and not already past. */
export function freePromoRounds(date: string, nextFree: Map<string, number>, now = Date.now()) {
  const dayStart = firstRoundOfDay(date)
  return Math.max(0, dayStart + PROMO_ROUNDS_PER_DAY - Math.max(nextFree.get(date) ?? dayStart, sixHourBlockIndex(now)))
}
