export type RegionId =
  | 'thailand'
  | 'north'
  | 'central'
  | 'northeast'
  | 'west'
  | 'east'
  | 'south'

export type CategoryId =
  | 'street_food'
  | 'travel_nature'
  | 'cafe_lifestyle'
  | 'arts_culture'
  | 'business_startup'
  | 'personal_memory'

export type WindowStatus = 'available' | 'occupied' | 'for_resale'

export type ZoomLevel = 'compact' | 'medium' | 'large'

/** Grid filter: a window status, a personal view, or one of the effect filters. */
export type StatusFilter =
  | 'all'
  | WindowStatus
  | 'my'
  | 'follow'
  | 'fx_hot'
  | 'fx_new'
  | 'fx_daily'
  | 'fx_star'

export type HubTab = 'rules' | 'filter' | 'wallet' | 'stats'

export type AuthMode = 'login' | 'signup' | 'switch'

export interface Region {
  id: RegionId
  name: string
  englishName: string
  codePrefix: string
  icon: string
  description: string
  provinces: string[]
  gradient: string
  accentColor: string
  windowCount: number
  /** The national (Thailand) board, as opposed to the six regional boards. */
  isCoreHeart?: boolean
}

export interface Category {
  label: string
  icon: string
  color: string
}

export interface User {
  id: string
  name: string
  citizenId: string
  phone: string
  email: string
  password?: string
  balance: number
  avatarUrl: string
  bio?: string
  isVerified: boolean
  verifiedAt?: string
  createdAt: string
  payoutAccount?: PayoutAccount
  /** Admins can open the admin page (platform settings). */
  role?: 'admin'
  /** Set by an admin: the account can browse but cannot buy, sell or claim. */
  suspended?: boolean
}

/** Where resale and rental income is paid (net 95%). */
export interface PayoutAccount {
  type: 'promptpay' | 'bank'
  promptpayType?: 'citizenId' | 'phone'
  bankCode?: string
  bankName?: string
  /** PromptPay ID (citizen ID or phone) or bank account number. */
  accountNumber: string
  accountName: string
  autoPayout: boolean
  isVerified: boolean
  updatedAt: string
}

export interface ImageUpdate {
  date: string
  imageUrl: string
  caption: string
}

export interface OwnerHistoryEntry {
  ownerId: string
  transferredAt: string
  type: 'resale' | 'transfer'
}

/** A note shown on the window for the current Thai calendar day only. */
export interface DailyNote {
  day: string
  text: string
  at: string
}

export interface WindowItem {
  id: number
  code: string
  region: RegionId
  title: string
  description: string
  imageUrl: string
  category: CategoryId
  province: string
  status: WindowStatus
  claimPrice: number
  resalePrice?: number
  ownerName: string
  ownerId: string
  ownerCitizenId?: string
  ownerPhone?: string
  ownerContact?: string
  externalLink?: string
  claimedAt?: string
  ownerChangedAt?: string
  /** `new` = first claim or fresh opening, `owner` = changed hands by resale. */
  ownerChangeKind?: 'new' | 'owner'
  lastPurchasePrice?: number
  lastImageUpdatedAt?: string
  /** Owner edits made on the given Thai calendar day (see getEditStatus). */
  editsToday?: { day: string; count: number }
  imageUpdateHistory: ImageUpdate[]
  previousOwnerId?: string
  previousOwnerHistory?: OwnerHistoryEntry[]
  viewsCount: number
  likesCount: number
  dailyLikes?: { day: string; count: number }
  followersBase?: number
  followerIds?: string[]
  dailyNote?: DailyNote
  /** Position on the board in the current rotation cycle (1–500). */
  slotPosition: number
  /** Held for a buyer whose transfer slip is waiting for an admin; nobody else can buy it meanwhile. */
  reserved?: boolean
}

export type TransactionType = 'claim' | 'resale' | 'transfer' | 'topup' | 'promo' | 'refund' | 'edit_fee'

export interface Transaction {
  id: string
  date: string
  windowId: number
  windowCode: string
  region: RegionId
  windowTitle: string
  fromOwner: string
  fromOwnerId?: string
  toOwner: string
  toOwnerId: string
  amount: number
  type: TransactionType
  commissionRate?: number
  commissionAmount?: number
  netSellerAmount?: number
  verifiedCitizenId?: string
  slipUrl?: string
  slipRef?: string
  slipStatus?: 'approved'
  approvedAt?: string
  /** How the buyer paid: from the wallet, from an external channel, or both. */
  walletAmount?: number
  externalAmount?: number
  channelName?: string
  /** Payment order this transaction settled (see PaymentOrder). */
  orderId?: string
}

/** Proof of an external payment (transfer slip or gateway reference). */
export interface PaymentSlip {
  slipUrl: string
  slipRef: string
}

/** How a purchase is paid: wallet first, the rest through one external channel. */
export interface PaymentBreakdown {
  walletAmount: number
  externalAmount: number
  channelId?: string
  channelName?: string
  slip?: PaymentSlip
}

// ---------------------------------------------------------------- platform settings (admin)

export type PaymentChannelType = 'promptpay' | 'bank' | 'truemoney' | 'card'

/** A way the platform receives money (shown at checkout and top-up). */
export interface PaymentChannel {
  id: string
  type: PaymentChannelType
  /** Display name, e.g. "พร้อมเพย์ บริษัท" or "กสิกรไทย ออมทรัพย์". */
  name: string
  enabled: boolean
  accountName?: string
  /** PromptPay ID, bank account number or TrueMoney phone. Not used for card. */
  accountNumber?: string
  bankCode?: string
  note?: string
}

/** Resale cap for windows that have been used, applied while age < upToYears. */
export interface PriceCapTier {
  id: string
  /** Upper bound of the age range in years (exclusive); null = and older. */
  upToYears: number | null
  /** Max multiple of the base price; null = no cap (market price). */
  multiplier: number | null
}

export interface PlatformSettings {
  priceCaps: {
    /** Cap for windows never used (no content, history, notes or likes); null = no cap. */
    unusedMultiplier: number | null
    /** Sorted by upToYears; the last tier is open-ended (upToYears null). */
    usedTiers: PriceCapTier[]
  }
  paymentChannels: PaymentChannel[]
  topUp: {
    min: number
    max: number
    presets: number[]
  }
  /** How often owners may change their window's image/text. */
  editPolicy: {
    /** Free edits per window per Thai calendar day. */
    freeEditsPerDay: number
    /** Price of each edit after the free ones, taken from the wallet; 0 = no extra edits. */
    paidEditPrice: number
  }
  updatedAt?: string
}

export interface WindowContentInput {
  title: string
  description: string
  imageUrl: string
  category: CategoryId
  province: string
  ownerContact?: string
  externalLink?: string
  caption?: string
  dailyNote?: string
}

export interface Quota {
  thailandCount: number
  regionalCount: number
  totalCount: number
  canAcquireThailand: boolean
  canAcquireRegional: boolean
  canAcquireTotal: boolean
  thailandWindow?: WindowItem
  regionalWindow?: WindowItem
}

export interface StatusCounts {
  all: number
  available: number
  for_resale: number
  occupied: number
  my: number
  follow: number
  fx_hot: number
  fx_new: number
  fx_daily: number
  fx_star: number
}

export type Result<T extends object = object> =
  | ({ success: true } & T)
  | { success: false; error: string; requiresKYC?: boolean }

// ---------------------------------------------------------------- payments & admin (API)

export type PaymentOrderKind = 'topup' | 'claim' | 'resale' | 'promo'
export type PaymentOrderStatus = 'pending' | 'approved' | 'rejected'

/**
 * A payment that needs an external part (transfer slip or card). Slip payments stay
 * `pending` until an admin checks the slip; the wallet part is held in the meantime.
 */
export interface PaymentOrder {
  id: string
  userId: string
  userName: string
  kind: PaymentOrderKind
  /** e.g. "จับจอง KAP-TH-040" or "เติมเงินเข้ากระเป๋า". */
  label: string
  amount: number
  walletAmount: number
  externalAmount: number
  channelId?: string
  channelName?: string
  slipUrl?: string
  slipRef?: string
  status: PaymentOrderStatus
  createdAt: string
  decidedAt?: string
  decidedBy?: string
  /** Reason given by the admin when rejecting. */
  note?: string
  region?: RegionId
  windowId?: number
  promoRequestId?: string
}

export interface AuditEntry {
  id: string
  at: string
  adminId: string
  adminName: string
  action: string
  detail: string
}
