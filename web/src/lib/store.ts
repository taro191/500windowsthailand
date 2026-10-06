// Client data layer. Everything comes from the API (server/): reads are synchronous from an
// in-memory cache filled by init(), actions call the API, update the cache and resolve to a
// `Result` instead of throwing.
import type {
  PaymentBreakdown,
  PaymentChannel,
  PaymentOrder,
  PaymentSlip,
  PayoutAccount,
  PlatformSettings,
  Quota,
  RegionId,
  Result,
  Transaction,
  User,
  WindowContentInput,
  WindowItem,
} from '@shared/types'
import { REGION_IDS } from '@shared/regions'
import { createEmptyWindows } from '@shared/seedWindows'
import { getRotationCycle } from '@shared/thaiTime'
import { orderWindowsForCycle } from '@shared/boardOrder'
import type { PromoAd, PromoRequest } from '@shared/promo'
import { get, patch, post, type ApiResult } from './api'
import { enabledChannels, setSettings } from './settings'
import { setPromoData } from './promo'

export interface AppConfig {
  /** "simulated" until a payment gateway is chosen. */
  cardPayments: 'simulated' | 'disabled'
  /** "dev": the OTP is shown on screen (no SMS provider yet). */
  otpMode: 'dev'
  /** Demo helpers: sample slip, skip the 24h edit wait, back-date ownership. */
  demoTools: boolean
  signupBonus: number
  minPasswordLength: number
}

interface SessionData {
  user: User | null
  transactions: Transaction[]
  orders: PaymentOrder[]
  promoRequests: PromoRequest[]
}

let appConfig: AppConfig = { cardPayments: 'simulated', otpMode: 'dev', demoTools: false, signupBonus: 0, minPasswordLength: 8 }
let currentUser: User | null = null
let transactions: Transaction[] = []
let orders: PaymentOrder[] = []
const windowsByRegion = new Map<RegionId, WindowItem[]>()

export const getAppConfig = () => appConfig
export const isDemo = () => appConfig.demoTools

// ---------------------------------------------------------------- cache

/** Windows from the API overlaid on the empty board (the API only sends changed windows). */
function applyBoards(changed: WindowItem[]) {
  for (const region of REGION_IDS) {
    const overlay = new Map(changed.filter((w) => w.region === region).map((w) => [w.id, w]))
    windowsByRegion.set(
      region,
      createEmptyWindows(region).map((w) => overlay.get(w.id) || w),
    )
  }
}

function putWindow(window: WindowItem) {
  const list = windowsByRegion.get(window.region)
  if (!list) return
  windowsByRegion.set(
    window.region,
    list.map((w) => (w.id === window.id ? window : w)),
  )
}

function applySession(data: SessionData) {
  currentUser = data.user
  transactions = data.transactions
  orders = data.orders
  setPromoData({ myRequests: data.promoRequests })
}

/** Loads config, session, boards and promo data. Call once before rendering. */
export async function init(): Promise<Result> {
  const [config, session, boards, promo] = await Promise.all([
    get<AppConfig & { settings: PlatformSettings }>('/config'),
    get<SessionData>('/session'),
    get<{ windows: WindowItem[] }>('/boards'),
    get<{ ads: PromoAd[]; reservedRounds: Record<string, number> }>('/promo'),
  ])
  if (!config.success) return config
  if (!session.success) return session
  if (!boards.success) return boards
  if (!promo.success) return promo
  const { settings, ...rest } = config
  appConfig = rest
  setSettings(settings)
  applySession(session)
  applyBoards(boards.windows)
  setPromoData({ ads: promo.ads, reservedRounds: promo.reservedRounds })
  return { success: true }
}

export async function refreshSession() {
  const session = await get<SessionData>('/session')
  if (session.success) applySession(session)
}

export async function refreshBoards() {
  const boards = await get<{ windows: WindowItem[] }>('/boards')
  if (boards.success) applyBoards(boards.windows)
}

export async function refreshPromo() {
  const promo = await get<{ ads: PromoAd[]; reservedRounds: Record<string, number> }>('/promo')
  if (promo.success) setPromoData({ ads: promo.ads, reservedRounds: promo.reservedRounds })
}

/** Called after an admin saves settings. */
export async function refreshConfig() {
  const config = await get<{ settings: PlatformSettings }>('/config')
  if (config.success) setSettings(config.settings)
}

// ---------------------------------------------------------------- reads

export const loadCurrentUser = () => currentUser
export const loadTransactions = () => transactions
/** The signed-in user's payment orders (pending ones wait for a slip check). */
export const loadOrders = () => orders

/** Raw windows of a region in id order. */
export const loadRegionWindows = (region: RegionId): WindowItem[] => windowsByRegion.get(region) ?? createEmptyWindows(region)

/** Windows of a region in the order they appear on the board this rotation cycle. */
export function loadBoard(region: RegionId, forceRandom = false): WindowItem[] {
  return orderWindowsForCycle(region, loadRegionWindows(region), getRotationCycle().cycleKey, forceRandom)
}

const ACTIVE_REGION_KEY = 'thai_windows_active_region'

export function loadActiveRegion(): RegionId {
  try {
    const saved = localStorage.getItem(ACTIVE_REGION_KEY) as RegionId | null
    return saved && REGION_IDS.includes(saved) ? saved : 'thailand'
  } catch {
    return 'thailand'
  }
}

export function saveActiveRegion(region: RegionId) {
  try {
    localStorage.setItem(ACTIVE_REGION_KEY, region)
  } catch {
    /* private mode: not remembered */
  }
}

/**
 * Windows the user holds: max 1 on the Thailand board + 1 on any regional board.
 * Windows held for the user's pending payments count too (the server checks the same).
 */
export function getQuota(userId: string): Quota {
  const held: WindowItem[] = []
  for (const region of REGION_IDS) for (const w of loadRegionWindows(region)) if (w.ownerId === userId) held.push(w)
  for (const order of orders) {
    if (order.status !== 'pending' || !order.region || !order.windowId || order.kind === 'topup' || order.kind === 'promo') continue
    const w = loadRegionWindows(order.region).find((x) => x.id === order.windowId)
    if (w && !held.includes(w)) held.push(w)
  }
  const thailand = held.filter((w) => w.region === 'thailand')
  const regional = held.filter((w) => w.region !== 'thailand')
  return {
    thailandCount: thailand.length,
    regionalCount: regional.length,
    totalCount: held.length,
    canAcquireThailand: thailand.length < 1,
    canAcquireRegional: regional.length < 1,
    canAcquireTotal: held.length < 2,
    thailandWindow: thailand[0],
    regionalWindow: regional[0],
  }
}

/** Splits `price` into a wallet part (up to the balance) and the remainder. */
export function suggestPaymentSplit(balance: number, price: number, useWallet = true) {
  const walletAmount = useWallet ? Math.min(Math.max(0, balance), price) : 0
  return { walletAmount, externalAmount: price - walletAmount }
}

// ---------------------------------------------------------------- account

export interface SignupInput {
  name: string
  citizenId: string
  phone: string
  email: string
  password: string
}

async function startSession(result: ApiResult<SessionData>): Promise<Result<{ user: User }>> {
  if (!result.success) return result
  applySession(result)
  await refreshBoards() // follow flags depend on who is signed in
  return { success: true, user: result.user! }
}

export const signup = async (input: SignupInput) => startSession(await post<SessionData>('/auth/signup', input))

/** Log in by email, phone or citizen ID. */
export const login = async (identifier: string, password: string) =>
  startSession(await post<SessionData>('/auth/login', { identifier, password }))

export async function logout() {
  await post('/auth/logout')
  applySession({ user: null, transactions: [], orders: [], promoRequests: [] })
  await refreshBoards()
}

export async function updateProfile(changes: { name?: string; payoutAccount?: PayoutAccount }): Promise<Result<{ user: User }>> {
  const result = await patch<{ user: User }>('/me', changes)
  if (result.success) currentUser = result.user
  return result
}

/** Sends a KYC OTP; in dev mode the server returns the code. */
export const requestOtp = (phone: string) => post<{ devCode?: string }>('/kyc/otp', { phone })

/** KYC: a valid 13-digit citizen ID not used by another account, a Thai mobile and its OTP. */
export async function verifyIdentity(citizenId: string, phone: string, otp: string): Promise<Result<{ user: User }>> {
  const result = await post<{ user: User }>('/kyc/verify', { citizenId, phone, otp })
  if (result.success) currentUser = result.user
  return result
}

// ---------------------------------------------------------------- payments

export interface PaymentOutcome {
  /** True when a transfer slip waits for an admin; the purchase completes after approval. */
  pending: boolean
  order?: PaymentOrder
  updatedUser: User
}

const paymentBody = (payment: PaymentBreakdown) => ({
  walletAmount: payment.walletAmount,
  externalAmount: payment.externalAmount,
  channelId: payment.channelId,
  slip: payment.slip?.slipUrl ? payment.slip : undefined,
})

type PurchaseResponse = { pending: boolean; order?: PaymentOrder; user: User; window: WindowItem }

async function afterPurchase(result: ApiResult<PurchaseResponse>): Promise<Result<PaymentOutcome & { updatedWindow: WindowItem }>> {
  if (!result.success) return result
  currentUser = result.user
  putWindow(result.window)
  await refreshSession()
  return { success: true, pending: result.pending, order: result.order, updatedUser: result.user, updatedWindow: result.window }
}

/** Claim an available window, paid from the wallet and/or an external channel. */
export async function claimWindow(region: RegionId, windowId: number, content: WindowContentInput, payment: PaymentBreakdown) {
  return afterPurchase(await post<PurchaseResponse>(`/windows/${region}/${windowId}/claim`, { content, payment: paymentBody(payment) }))
}

/** Buy a window listed for resale at `expectedPrice` (the seller receives 95%). */
export async function buyResaleWindow(region: RegionId, windowId: number, expectedPrice: number, payment: PaymentBreakdown) {
  return afterPurchase(await post<PurchaseResponse>(`/windows/${region}/${windowId}/buy`, { expectedPrice, payment: paymentBody(payment) }))
}

/** Top-up through a channel: card completes at once, a transfer slip waits for an admin. */
export async function topUpWallet(amount: number, channel: PaymentChannel, slip?: PaymentSlip): Promise<Result<PaymentOutcome>> {
  const result = await post<{ pending: boolean; order?: PaymentOrder; user: User }>('/wallet/topup', {
    amount,
    channelId: channel.id,
    slip: slip?.slipUrl ? slip : undefined,
  })
  if (!result.success) return result
  currentUser = result.user
  await refreshSession()
  return { success: true, pending: result.pending, order: result.order, updatedUser: result.user }
}

export type PromoInput = Pick<
  PromoRequest,
  'brand' | 'tagline' | 'link' | 'contact' | 'images' | 'size' | 'rounds' | 'scheduleMode' | 'startDate' | 'termsAccepted'
>

/** Pays for a promo request at submission and sends it for review. */
export async function payPromoRequest(request: PromoInput, payment: PaymentBreakdown): Promise<Result<{ request: PromoRequest; updatedUser: User }>> {
  const result = await post<{ request: PromoRequest; user: User }>('/promo/requests', { request, payment: paymentBody(payment) })
  if (!result.success) return result
  currentUser = result.user
  await Promise.all([refreshSession(), refreshPromo()])
  return { success: true, request: result.request, updatedUser: result.user }
}

// ---------------------------------------------------------------- window actions

async function windowAction(result: ApiResult<{ window: WindowItem }>): Promise<Result<{ updatedWindow: WindowItem }>> {
  if (!result.success) return result
  putWindow(result.window)
  return { success: true, updatedWindow: result.window }
}

/** Full window (all image and owner history); `view` also counts a visit. */
export async function fetchWindow(region: RegionId, windowId: number, view = false): Promise<WindowItem | null> {
  const result = await get<{ window: WindowItem }>(`/windows/${region}/${windowId}${view ? '?view=1' : ''}`)
  if (!result.success) return null
  putWindow(result.window)
  return result.window
}

/** List an owned window for resale (after 30 days, at 100 ฿ up to the price cap). */
export const listForResale = async (region: RegionId, windowId: number, price: number) =>
  windowAction(await post(`/windows/${region}/${windowId}/listing`, { price }))

export const cancelResale = async (region: RegionId, windowId: number) =>
  windowAction(await post(`/windows/${region}/${windowId}/listing/cancel`))

export interface WindowEditInput extends Omit<WindowContentInput, 'imageUrl'> {
  /** Only set when the owner picked a new image. */
  imageUrl?: string
  caption?: string
  dailyNote?: string
}

/** Owner edit (once per 24 hours). A new image is added to the image history. */
export const editWindow = async (region: RegionId, windowId: number, input: WindowEditInput) =>
  windowAction(await patch(`/windows/${region}/${windowId}/content`, input))

/** One like per visitor per day; returns the updated window. */
export async function likeWindow(region: RegionId, windowId: number): Promise<{ window: WindowItem; counted: boolean } | null> {
  const result = await post<{ window: WindowItem; counted: boolean }>(`/windows/${region}/${windowId}/like`)
  if (!result.success) return null
  putWindow(result.window)
  return { window: result.window, counted: result.counted }
}

export async function toggleFollow(region: RegionId, windowId: number): Promise<WindowItem | null> {
  const result = await post<{ window: WindowItem }>(`/windows/${region}/${windowId}/follow`)
  if (!result.success) return null
  putWindow(result.window)
  return result.window
}

// ---------------------------------------------------------------- demo helpers (DEMO_TOOLS=true on the server)

/** Lets the owner edit again right away by back-dating the last edit. */
export const demoSkipEditCooldown = async (region: RegionId, windowId: number) =>
  windowAction(await post(`/demo/windows/${region}/${windowId}/skip-cooldown`))

/** Pretends the window was acquired `days` days ago (to test the 30-day rule and price tiers). */
export const demoBackdateOwnership = async (region: RegionId, windowId: number, days: number) =>
  windowAction(await post(`/demo/windows/${region}/${windowId}/backdate`, { days }))

/** Channels offered at checkout and top-up (card only while the server accepts it). */
export const paymentChannels = (settings: PlatformSettings): PaymentChannel[] =>
  enabledChannels(settings).filter((c) => c.type !== 'card' || appConfig.cardPayments === 'simulated')
