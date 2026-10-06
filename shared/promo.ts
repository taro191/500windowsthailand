// Promo area: windows 481–486 are reserved for sponsored ads. Pricing, request shape and
// booking limits are shared by the web app and the API; board placement lives in the web app.

export const PROMO_SLOTS = [481, 482, 483, 484, 485, 486]
export const PROMO_SIZES = [2, 3, 4, 6]

export const isPromoSlot = (id: number) => id >= 481 && id <= 486

export type PromoLayout = 'horizontal' | 'vertical' | 'cluster' | 'scatter'
export const PROMO_LAYOUTS: PromoLayout[] = ['horizontal', 'vertical', 'cluster', 'scatter']
export const PROMO_LAYOUT_LABELS: Record<PromoLayout, string> = {
  horizontal: 'ต่อกันแนวนอน',
  vertical: 'ต่อกันแนวตั้ง',
  cluster: 'รวมเป็นก้อน',
  scatter: 'แยกกันคนละจุด',
}

export interface PromoAd {
  brand: string
  tagline?: string
  link?: string
  image?: string
  /** Number of windows the ad occupies (1–6). */
  size: number
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

export const promoPrice = (size: number, rounds: number) => size * rounds * PROMO_PRICE_PER_WINDOW_ROUND

/** Rounds still free on `date`, given the rounds already reserved that day. */
export const roundsLeft = (reserved: number) => Math.max(0, PROMO_ROUNDS_PER_DAY - reserved)

/** Only http(s) or inline image data; anything else becomes ''. */
export const safeImageUrl = (url?: string) => (url && /^(https?:\/\/|data:image\/|\/uploads\/)/i.test(url) ? url : '')
export const safeHttpUrl = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : '')
