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

export type AuthMode = 'login' | 'signup'

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
  /** Disabled by an admin: cannot log in at all (suspended only blocks trading). */
  disabled?: boolean
  /** The one admin who can create users and grant or remove admin rights (SUPER_ADMIN_EMAIL). */
  superAdmin?: boolean
  /** Windows an admin allows on top of the normal quota (1 Thailand + 1 regional); absent = none. */
  extraWindows?: ExtraWindows
}

export interface ExtraWindows {
  thailand: number
  regional: number
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

/** A piece of work or a product on the window page: up to 3 photos with a name and details. */
export interface ShowcaseItem {
  images: string[]
  name: string
  /** Works: category / year; products: price. */
  sub: string
  detail: string
}

/** A link in "ช่องทางนำเสนอผลงาน"; `icon` is one of PROFILE_LINK_TYPES. */
export interface ProfileLink {
  icon: string
  label: string
  url: string
}

/** What the window page shows and allows; the owner switches each one. */
export interface ProfileDisplay {
  views: boolean
  likes: boolean
  today: boolean
  followers: boolean
  /** Visitors may follow the window. */
  follow: boolean
  /** Visitors may write new reviews. */
  reviews: boolean
}

/** When "Friend and Co" takes link requests; dates are Thai calendar days `YYYY-MM-DD` or ''. */
export interface FriendSettings {
  open: boolean
  from: string
  to: string
  note: string
}

/** The owner's public page for the window (detail popup); every field is optional to fill in. */
export interface WindowProfile {
  /** Square logo beside the name on the window page and on "Friend and Co" partner cards. */
  logoUrl: string
  /** Name shown as the owner of this window (e.g. the shop); the account name when empty. */
  ownerLabel: string
  tags: string[]
  /** Extra photos after the main window image. */
  gallery: string[]
  works: ShowcaseItem[]
  products: ShowcaseItem[]
  links: ProfileLink[]
  phone: string
  lineId: string
  about: string
  display: ProfileDisplay
  friend: FriendSettings
}

export interface WindowReview {
  id: string
  userId: string
  userName: string
  userAvatarUrl: string
  rating: number
  text: string
  createdAt: string
}

/** A post on the window's daily updates (current owner only). */
export interface WindowUpdate {
  id: string
  text: string
  createdAt: string
  editedAt?: string
}

/** Another window as shown in "Friend and Co". */
export interface LinkedWindow {
  region: RegionId
  id: number
  code: string
  title: string
  imageUrl: string
  logoUrl: string
}

export interface WindowLink {
  id: string
  window: LinkedWindow
  requesterName: string
  message: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
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
  /** The owner's name for this window (profile.ownerLabel), when set; show it instead of ownerName. */
  ownerLabel?: string
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
  /** Detail only (not on the boards): the owner's public page, and reviews from the current owner's time. */
  profile?: WindowProfile
  reviews?: WindowReview[]
  reviewStats?: { average: number; count: number }
  /** Detail only: the current owner's daily updates, newest first. */
  updates?: WindowUpdate[]
  /** Detail only: approved "Friend and Co" links. */
  links?: WindowLink[]
  /** Detail only, owner only: requests waiting for approval. */
  linkRequests?: WindowLink[]
  /** Detail only: the viewer's own requests to this window. */
  myLinkRequests?: WindowLink[]
}

export type TransactionType = 'claim' | 'resale' | 'transfer' | 'topup' | 'promo' | 'refund' | 'edit_fee' | 'bonus'

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

/** "Contact us" details shown in the footer and on the contact page; blank fields are hidden. */
export interface ContactInfo {
  companyName: string
  address: string
  phone: string
  email: string
  /** e.g. "@370lknmk" */
  lineId: string
  /** Add-friend link, e.g. https://line.me/R/ti/p/@370lknmk */
  lineUrl: string
  facebookUrl: string
  openHours: string
  /** Shows the contact form, whose messages go to the admins' LINE. */
  formEnabled: boolean
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
  /** General rules, editable on the admin rules page. */
  rules: {
    /** Price of claiming an empty window (lifetime ownership). */
    claimPrice: number
    /** Share of each resale price kept by the platform, in percent (e.g. 5). */
    commissionPercent: number
    /** Days an owner must hold a window before listing it for resale. */
    minHoldingDays: number
    minResalePrice: number
    /** Promotion price per window per 6-hour round. */
    promoPricePerWindowRound: number
  }
  /** Wallet credit for accounts that sign up between startsAt and endsAt (ISO; null = open). 0 = off. */
  signupBonus: {
    amount: number
    startsAt: string | null
    endsAt: string | null
  }
  contact: ContactInfo
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
  /** Normal quota plus the user's extraWindows (see windowQuota.ts). */
  thailandLimit: number
  regionalLimit: number
  totalLimit: number
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

/** A message from the "contact us" form, as admins see it. */
export interface ContactMessageEntry {
  id: string
  createdAt: string
  name: string
  email: string
  phone: string
  subject: string
  message: string
  userId: string | null
  userName: string | null
  status: 'new' | 'done'
  adminNote: string
  handledBy: string | null
  handledAt: string | null
}

export interface AuditEntry {
  id: string
  at: string
  adminId: string
  adminName: string
  action: string
  detail: string
}
