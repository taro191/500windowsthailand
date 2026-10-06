// Demo persistence layer. Everything lives in localStorage; swap these functions for
// API calls when the backend exists. All mutations return a `Result` instead of throwing.
import type {
  PaymentBreakdown,
  PaymentChannel,
  PaymentSlip,
  Quota,
  RegionId,
  Result,
  Transaction,
  User,
  WindowContentInput,
  WindowItem,
} from '@/types'
import { ADMIN_USER, DEMO_USERS, DEFAULT_AVATAR_URL, NEW_USER, STARTING_BALANCE } from '@/data/demoUsers'
import { REGION_IDS, REGIONS_BY_ID } from '@/data/regions'
import { createInitialWindows } from '@/data/seedWindows'
import { isValidCitizenId, isValidThaiMobile } from './identity'
import { DAY_MS, getRotationCycle, thaiDayKey } from './thaiTime'
import { likesToday } from './windowBadges'
import {
  CLAIM_PRICE,
  getEditAvailability,
  getHoldingPeriod,
  getPriceCap,
  MIN_RESALE_PRICE,
  RESALE_COMMISSION_RATE,
} from './ownershipRules'
import { orderWindowsForCycle } from './boardOrder'
import { savePromoRequest, updatePromoRequest, type PromoRequest } from './promo'

/** Demo build: external payments (QR, slip check, gateway) are simulated. */
export const DEMO_MODE = true

const PREFIX = 'thai_windows_v11_clean_'
const USERS_KEY = `${PREFIX}users`
const CURRENT_USER_KEY = `${PREFIX}current_user`
const TRANSACTIONS_KEY = `${PREFIX}transactions`
const ACTIVE_REGION_KEY = `${PREFIX}active_region`
const regionKey = (region: RegionId) => `${PREFIX}region_${region}`

const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* storage full or blocked: the demo keeps running in memory */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  /** Removes this app's keys, including ones from older demo versions. */
  clearAppData() {
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('thai_windows_') || key.startsWith('windows_thailand_'))) keys.push(key)
      }
      keys.forEach((key) => localStorage.removeItem(key))
    } catch {
      /* ignore */
    }
  },
}

const normalizeDigits = (value: string) => value.replace(/[-\s]/g, '')
const nowIso = () => new Date().toISOString()
const randomSuffix = () => Math.random().toString(36).substring(2, 6)

// ---------------------------------------------------------------- users

export function loadUsers(): User[] {
  try {
    const raw = storage.get(USERS_KEY)
    if (!raw) {
      storage.set(USERS_KEY, JSON.stringify(DEMO_USERS))
      return DEMO_USERS
    }
    const users: User[] = JSON.parse(raw)
    if (!Array.isArray(users) || users.length === 0) return DEMO_USERS
    // Data saved before the admin account existed: add it.
    if (!users.some((u) => u.id === ADMIN_USER.id)) {
      users.push(ADMIN_USER)
      saveUsers(users)
    }
    return users
  } catch {
    return DEMO_USERS
  }
}

export function saveUsers(users: User[]) {
  storage.set(USERS_KEY, JSON.stringify(users))
}

export function loadCurrentUser(): User | null {
  try {
    const raw = storage.get(CURRENT_USER_KEY)
    if (!raw) {
      const user = loadUsers().find((u) => u.id === NEW_USER.id) || NEW_USER
      saveCurrentUser(user)
      return user
    }
    return JSON.parse(raw)
  } catch {
    return NEW_USER
  }
}

export function saveCurrentUser(user: User | null) {
  if (user) storage.set(CURRENT_USER_KEY, JSON.stringify(user))
  else storage.remove(CURRENT_USER_KEY)
}

export interface SignupInput {
  name: string
  citizenId: string
  phone: string
  email: string
  password?: string
  avatarUrl?: string
  isVerified?: boolean
}

export function signup(input: SignupInput): Result<{ user: User }> {
  const users = loadUsers()
  const email = input.email.trim().toLowerCase()
  const phone = normalizeDigits(input.phone.trim())
  const citizenId = normalizeDigits(input.citizenId.trim())

  if (!input.name.trim()) return { success: false, error: 'กรุณากรอกชื่อ-นามสกุล' }
  if (!citizenId) return { success: false, error: 'กรุณากรอกเลขประจำตัวประชาชน 13 หลัก' }
  if (citizenId.length !== 13) return { success: false, error: 'เลขประจำตัวประชาชนต้องมี 13 หลัก' }
  if (!phone) return { success: false, error: 'กรุณากรอกเบอร์โทรศัพท์' }
  if (!email) return { success: false, error: 'กรุณากรอกอีเมล' }
  if (users.find((u) => normalizeDigits(u.citizenId) === citizenId))
    return { success: false, error: 'เลขบัตรประชาชนนี้ถูกลงทะเบียนไว้ในระบบแล้ว' }
  if (users.find((u) => normalizeDigits(u.phone) === phone))
    return { success: false, error: 'เบอร์โทรศัพท์นี้ถูกใช้งานในระบบแล้ว' }
  if (users.find((u) => u.email.toLowerCase() === email)) return { success: false, error: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' }

  const user: User = {
    id: `user_${Date.now()}_${randomSuffix()}`,
    name: input.name.trim(),
    citizenId: input.citizenId.trim(),
    phone: input.phone.trim(),
    email,
    password: input.password || 'password123',
    balance: STARTING_BALANCE,
    avatarUrl: input.avatarUrl || DEFAULT_AVATAR_URL,
    isVerified: !!input.isVerified,
    verifiedAt: input.isVerified ? nowIso() : undefined,
    createdAt: nowIso(),
  }
  saveUsers([...users, user])
  saveCurrentUser(user)
  return { success: true, user }
}

/** Log in by email, phone, citizen ID or display name. */
export function login(identifier: string, password?: string): Result<{ user: User }> {
  const query = identifier.trim().toLowerCase()
  const digits = normalizeDigits(query)
  const user = loadUsers().find(
    (u) =>
      u.email.toLowerCase() === query ||
      normalizeDigits(u.phone) === digits ||
      normalizeDigits(u.citizenId) === digits ||
      u.name.toLowerCase() === query,
  )
  if (!user) {
    return {
      success: false,
      error: 'ไม่พบบัญชีผู้ใช้ที่ระบุ กรุณาตรวจสอบอีเมล เบอร์โทร หรือเลขบัตรประชาชน หรือกดสมัครสมาชิกใหม่',
    }
  }
  if (password && user.password && user.password !== password) {
    return { success: false, error: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' }
  }
  saveCurrentUser(user)
  return { success: true, user }
}

export function updateUser(userId: string, changes: Partial<User>): Result<{ user: User }> {
  const users = loadUsers()
  const index = users.findIndex((u) => u.id === userId)
  if (index === -1) return { success: false, error: 'ไม่พบบัญชีผู้ใช้' }
  const user = { ...users[index], ...changes }
  users[index] = user
  saveUsers(users)
  if (loadCurrentUser()?.id === userId) saveCurrentUser(user)
  return { success: true, user }
}

/** KYC: a valid 13-digit citizen ID not used by another account, plus a Thai mobile number. */
export function verifyIdentity(userId: string, citizenId: string, phone: string): Result<{ user: User }> {
  const digits = citizenId.replace(/[^0-9]/g, '')
  if (digits.length !== 13) return { success: false, error: 'เลขบัตรประชาชนต้องมี 13 หลัก' }
  if (!isValidCitizenId(digits))
    return { success: false, error: 'เลขประจำตัวประชาชนไม่ถูกต้องตามสูตรคำนวณของกรมการปกครอง' }
  if (!isValidThaiMobile(phone))
    return { success: false, error: 'เบอร์โทรศัพท์ต้องมี 10 หลักและขึ้นต้นด้วย 06, 08 หรือ 09' }
  if (loadUsers().find((u) => u.id !== userId && u.citizenId.replace(/[^0-9]/g, '') === digits))
    return { success: false, error: 'เลขบัตรประชาชนนี้ผูกกับบัญชีอื่นแล้วในระบบ' }
  return updateUser(userId, { citizenId: citizenId.trim(), phone: phone.trim(), isVerified: true, verifiedAt: nowIso() })
}

/** Adds `amount` (negative to deduct) to a wallet; never goes below 0. */
export function adjustBalance(userId: string, amount: number): User | null {
  const users = loadUsers()
  const index = users.findIndex((u) => u.id === userId)
  if (index === -1) return null
  users[index] = { ...users[index], balance: Math.max(0, users[index].balance + amount) }
  saveUsers(users)
  if (loadCurrentUser()?.id === userId) saveCurrentUser(users[index])
  return users[index]
}

// ---------------------------------------------------------------- regions & windows

export function loadActiveRegion(): RegionId {
  const saved = storage.get(ACTIVE_REGION_KEY) as RegionId | null
  return saved && REGION_IDS.includes(saved) ? saved : 'thailand'
}

export function saveActiveRegion(region: RegionId) {
  storage.set(ACTIVE_REGION_KEY, region)
}

/** Raw windows of a region in id order (seeded on first use). */
export function loadRegionWindows(region: RegionId): WindowItem[] {
  const raw = storage.get(regionKey(region))
  if (!raw) {
    const windows = createInitialWindows(region)
    saveRegionWindows(region, windows)
    return windows
  }
  try {
    const windows = JSON.parse(raw)
    if (Array.isArray(windows) && windows.length === 500) return windows
    const fresh = createInitialWindows(region)
    saveRegionWindows(region, fresh)
    return fresh
  } catch {
    return createInitialWindows(region)
  }
}

export function saveRegionWindows(region: RegionId, windows: WindowItem[]) {
  storage.set(regionKey(region), JSON.stringify(windows))
}

/** Windows of a region in the order they appear on the board this rotation cycle. */
export function loadBoard(region: RegionId, forceRandom = false): WindowItem[] {
  return orderWindowsForCycle(region, loadRegionWindows(region), getRotationCycle().cycleKey, forceRandom)
}

/** Loads a region, applies `change` to one window and saves. Returns null if not found. */
function updateWindow(
  region: RegionId,
  windowId: number,
  change: (window: WindowItem) => WindowItem,
): WindowItem | null {
  const windows = loadRegionWindows(region)
  const index = windows.findIndex((w) => w.id === windowId)
  if (index === -1) return null
  windows[index] = change(windows[index])
  saveRegionWindows(region, windows)
  return windows[index]
}

// ---------------------------------------------------------------- transactions

export function loadTransactions(): Transaction[] {
  try {
    const raw = storage.get(TRANSACTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function recordTransaction(entry: Omit<Transaction, 'id' | 'date'>): Transaction {
  const transactions = loadTransactions()
  const tx: Transaction = { ...entry, id: `tx_${Date.now()}_${randomSuffix()}`, date: nowIso() }
  transactions.unshift(tx)
  storage.set(TRANSACTIONS_KEY, JSON.stringify(transactions.slice(0, 150)))
  return tx
}

// ---------------------------------------------------------------- quota & permissions

/** How many windows the user holds: max 1 on the Thailand board + 1 on any regional board. */
export function getQuota(userId: string): Quota {
  let thailandCount = 0
  let regionalCount = 0
  let thailandWindow: WindowItem | undefined
  let regionalWindow: WindowItem | undefined
  for (const region of REGION_IDS) {
    for (const w of loadRegionWindows(region)) {
      if (w.ownerId !== userId) continue
      if (w.region === 'thailand') {
        thailandCount++
        thailandWindow ||= w
      } else {
        regionalCount++
        regionalWindow ||= w
      }
    }
  }
  const totalCount = thailandCount + regionalCount
  return {
    thailandCount,
    regionalCount,
    totalCount,
    canAcquireThailand: thailandCount < 1,
    canAcquireRegional: regionalCount < 1,
    canAcquireTotal: totalCount < 2,
    thailandWindow,
    regionalWindow,
  }
}

type ActionKind = 'claim' | 'buy' | 'sell' | 'transfer'

interface Permission {
  allowed: boolean
  reason?: string
  requiresKYC?: boolean
  quotaExceeded?: boolean
}

/** Every purchase or sale requires KYC; acquiring also has to fit within the 2-window quota. */
export function checkPermission(user: User | null, region: RegionId, action: ActionKind): Permission {
  if (!user) return { allowed: false, reason: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }
  if (user.suspended) return { allowed: false, reason: 'บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน' }
  if (!user.isVerified) {
    return {
      allowed: false,
      requiresKYC: true,
      reason:
        'ตามข้อบังคับระบบ: หากจะทำการซื้อหรือขายต่อ ต้องยืนยันตัวตนด้วยเลขบัตรประชาชน 13 หลักและเบอร์โทรศัพท์เท่านั้น',
    }
  }
  if (action === 'claim' || action === 'buy') {
    const quota = getQuota(user.id)
    const isThailand = region === 'thailand'
    if (isThailand && !quota.canAcquireThailand) {
      return {
        allowed: false,
        quotaExceeded: true,
        reason: `ไม่สามารถถือครองเพิ่มได้: ผู้ใช้งาน 1 คน (อ้างอิงเลขบัตรประชาชน ${user.citizenId}) สามารถมี "หน้าต่างบานประเทศไทย" ได้ไม่เกิน 1 บาน (ปัจจุบันคุณถือครองแล้ว: ${quota.thailandWindow?.code || '1 บาน'})`,
      }
    }
    if (!isThailand && !quota.canAcquireRegional) {
      const heldIn = quota.regionalWindow ? REGIONS_BY_ID[quota.regionalWindow.region]?.name : 'ภูมิภาค'
      return {
        allowed: false,
        quotaExceeded: true,
        reason: `ไม่สามารถถือครองเพิ่มได้: ผู้ใช้งาน 1 คน (อ้างอิงเลขบัตรประชาชน ${user.citizenId}) สามารถมี "หน้าต่างบานภูมิภาค" ได้ไม่เกิน 1 บาน (ปัจจุบันคุณถือครองแล้วใน${heldIn}: ${quota.regionalWindow?.code || '1 บาน'})`,
      }
    }
    if (!quota.canAcquireTotal) {
      return {
        allowed: false,
        quotaExceeded: true,
        reason: 'ไม่สามารถถือครองเพิ่มได้: คุณมีหน้าต่างครบ 2 บานตามโควตาสูงสุดแล้ว (ไทย 1 บาน + ภูมิภาค 1 บาน)',
      }
    }
  }
  return { allowed: true }
}

function denied(permission: Permission) {
  return { success: false as const, error: permission.reason!, requiresKYC: permission.requiresKYC }
}

// ---------------------------------------------------------------- payments

/**
 * Checks that a payment covers `price`: the wallet part must be available in the
 * user's balance and any remainder must come from an external channel with proof.
 */
function checkPayment(user: User, price: number, payment: PaymentBreakdown): string | null {
  const balance = loadUsers().find((u) => u.id === user.id)?.balance ?? user.balance
  if (payment.walletAmount < 0 || payment.externalAmount < 0) return 'ยอดชำระไม่ถูกต้อง'
  if (payment.walletAmount + payment.externalAmount !== price)
    return `ยอดชำระรวม (฿${(payment.walletAmount + payment.externalAmount).toLocaleString()}) ไม่ตรงกับราคา ฿${price.toLocaleString()}`
  if (payment.walletAmount > balance)
    return `ยอดเงินในกระเป๋าไม่เพียงพอ (ต้องการ ${payment.walletAmount.toLocaleString()} ฿ แต่คุณมี ${balance.toLocaleString()} ฿)`
  if (payment.externalAmount > 0 && !payment.slip) return 'ยังไม่ได้ยืนยันการชำระเงินส่วนที่เหลือผ่านช่องทางอื่น'
  return null
}

/** Payment fields stored on the transaction. */
function paymentFields(payment: PaymentBreakdown, now: string) {
  const slip = payment.slip
  return {
    walletAmount: payment.walletAmount,
    externalAmount: payment.externalAmount,
    channelName: payment.externalAmount > 0 ? payment.channelName : undefined,
    slipUrl: slip?.slipUrl,
    slipRef: slip?.slipRef,
    slipStatus: slip ? ('approved' as const) : undefined,
    approvedAt: slip ? now : undefined,
  }
}

/** Splits `price` into a wallet part (up to the balance) and the remainder. */
export function suggestPaymentSplit(balance: number, price: number, useWallet = true) {
  const walletAmount = useWallet ? Math.min(Math.max(0, balance), price) : 0
  return { walletAmount, externalAmount: price - walletAmount }
}

/** Credits the wallet after an external payment (top-up) and records it. */
export function topUpWallet(
  user: User,
  amount: number,
  channel: PaymentChannel,
  slip: PaymentSlip,
): Result<{ updatedUser: User }> {
  if (!(amount > 0)) return { success: false, error: 'จำนวนเงินไม่ถูกต้อง' }
  const updatedUser = adjustBalance(user.id, amount)
  if (!updatedUser) return { success: false, error: 'ไม่พบบัญชีผู้ใช้' }
  const now = nowIso()
  recordTransaction({
    windowId: 0,
    windowCode: 'TOP-UP',
    region: 'thailand',
    windowTitle: `เติมเงินเข้ากระเป๋าผ่าน ${channel.name}`,
    fromOwner: channel.name,
    toOwner: user.name,
    toOwnerId: user.id,
    amount,
    type: 'topup',
    ...paymentFields({ walletAmount: 0, externalAmount: amount, channelName: channel.name, slip }, now),
  })
  return { success: true, updatedUser }
}

/**
 * Pays for a promo request at submission (wallet first, rest through a channel) and saves
 * it as pending. If an admin rejects it the full amount is refunded to the wallet.
 */
export function payPromoRequest(
  user: User,
  request: PromoRequest,
  payment: PaymentBreakdown,
): Result<{ request: PromoRequest; updatedUser: User }> {
  if (user.suspended) return { success: false, error: 'บัญชีนี้ถูกระงับการทำธุรกรรมโดยผู้ดูแลระบบ กรุณาติดต่อทีมงาน' }
  const paymentError = checkPayment(user, request.price, payment)
  if (paymentError) return { success: false, error: paymentError }

  const now = nowIso()
  const paid: PromoRequest = {
    ...request,
    payment: {
      amount: request.price,
      walletAmount: payment.walletAmount,
      externalAmount: payment.externalAmount,
      channelName: payment.externalAmount > 0 ? payment.channelName : undefined,
      slipRef: payment.slip?.slipRef,
      paidAt: now,
    },
  }
  // Save first: if the browser storage is full nothing has been charged yet.
  if (!savePromoRequest(paid)) {
    return { success: false, error: 'บันทึกคำขอไม่สำเร็จ พื้นที่ในเบราว์เซอร์อาจเต็ม กรุณาลดจำนวนหรือขนาดรูป (ยังไม่ได้ตัดเงิน)' }
  }
  if (payment.walletAmount > 0) adjustBalance(user.id, -payment.walletAmount)
  const tx = recordTransaction({
    windowId: 0,
    windowCode: 'PROMO',
    region: 'thailand',
    windowTitle: `ค่าโปรโมท "${request.brand}" ${request.size} บาน · ${request.rounds} รอบ`,
    fromOwner: user.name,
    fromOwnerId: user.id,
    toOwner: 'พื้นที่โปรโมท 500 Windows',
    toOwnerId: 'platform',
    amount: request.price,
    type: 'promo',
    ...paymentFields(payment, now),
  })
  const saved = updatePromoRequest(request.id, (r) => ({ ...r, payment: { ...r.payment!, transactionId: tx.id } })) || paid
  return { success: true, request: saved, updatedUser: loadUsers().find((u) => u.id === user.id) || user }
}

// ---------------------------------------------------------------- window actions

/**
 * Claim an available window for 500 ฿, paid from the wallet and/or an external channel
 * (see PaymentBreakdown).
 */
export function claimWindow(
  region: RegionId,
  windowId: number,
  user: User,
  content: WindowContentInput,
  payment: PaymentBreakdown,
): Result<{ updatedWindow: WindowItem; updatedUser: User }> {
  const permission = checkPermission(user, region, 'claim')
  if (!permission.allowed) return denied(permission)

  const windows = loadRegionWindows(region)
  const index = windows.findIndex((w) => w.id === windowId)
  if (index === -1) return { success: false, error: 'ไม่พบบานหน้าต่างที่ต้องการ' }
  const window = windows[index]
  if (window.status !== 'available') return { success: false, error: 'หน้าต่างนี้มีผู้จับจองแล้ว' }

  const price = window.claimPrice || CLAIM_PRICE
  const paymentError = checkPayment(user, price, payment)
  if (paymentError) return { success: false, error: paymentError }

  const now = nowIso()
  const claimed: WindowItem = {
    ...window,
    title: content.title.trim() || `หน้าต่างของ ${user.name}`,
    description: content.description.trim() || 'บันทึกภาพถ่ายและเรื่องราวส่วนตัว',
    imageUrl: content.imageUrl,
    category: content.category,
    province: content.province || window.province || 'ประเทศไทย',
    ownerName: user.name,
    ownerId: user.id,
    ownerCitizenId: user.citizenId,
    ownerPhone: user.phone,
    ownerContact: content.ownerContact,
    externalLink: content.externalLink,
    status: 'occupied',
    claimedAt: now,
    ownerChangedAt: now,
    ownerChangeKind: 'new',
    lastPurchasePrice: price,
    lastImageUpdatedAt: now,
    imageUpdateHistory: [{ date: now, imageUrl: content.imageUrl, caption: 'ภาพเปิดตัวหน้าต่างบานใหม่' }],
  }
  windows[index] = claimed
  saveRegionWindows(region, windows)

  const updatedUser = (payment.walletAmount > 0 && adjustBalance(user.id, -payment.walletAmount)) || user
  recordTransaction({
    windowId,
    windowCode: window.code,
    region,
    windowTitle: claimed.title,
    fromOwner: `โครงการหน้าต่างประเทศไทย 500 บาน (${region})`,
    toOwner: user.name,
    toOwnerId: user.id,
    amount: price,
    type: 'claim',
    verifiedCitizenId: user.citizenId,
    ...paymentFields(payment, now),
  })
  return { success: true, updatedWindow: claimed, updatedUser }
}

/**
 * Buy a window listed for resale. The seller receives 95%; 5% is the platform commission.
 * The previous owner's personal data is removed, only their user ID is kept for history.
 */
export function buyResaleWindow(
  region: RegionId,
  windowId: number,
  buyer: User,
  payment: PaymentBreakdown,
): Result<{ updatedWindow: WindowItem; updatedBuyer: User }> {
  const permission = checkPermission(buyer, region, 'buy')
  if (!permission.allowed) return denied(permission)

  const windows = loadRegionWindows(region)
  const index = windows.findIndex((w) => w.id === windowId)
  if (index === -1) return { success: false, error: 'ไม่พบหน้าต่าง' }
  const window = windows[index]
  if (window.status !== 'for_resale' || !window.resalePrice)
    return { success: false, error: 'หน้าต่างบานนี้ไม่ได้เปิดขายต่อในขณะนี้' }
  if (window.ownerId === buyer.id) return { success: false, error: 'คุณเป็นเจ้าของหน้าต่างบานนี้อยู่แล้ว' }

  const price = window.resalePrice
  const paymentError = checkPayment(buyer, price, payment)
  if (paymentError) return { success: false, error: paymentError }

  const commission = Math.round(price * RESALE_COMMISSION_RATE)
  const sellerNet = price - commission
  const sellerName = window.ownerName
  const sellerId = window.ownerId
  const now = nowIso()
  const sold: WindowItem = {
    ...window,
    ownerName: buyer.name,
    ownerId: buyer.id,
    ownerCitizenId: buyer.citizenId,
    ownerPhone: buyer.phone,
    ownerContact: buyer.phone || buyer.email,
    externalLink: undefined,
    dailyNote: undefined,
    previousOwnerId: sellerId,
    previousOwnerHistory: [
      ...(window.previousOwnerHistory || []),
      { ownerId: sellerId, transferredAt: now, type: 'resale' },
    ],
    status: 'occupied',
    resalePrice: undefined,
    ownerChangedAt: now,
    ownerChangeKind: 'owner',
    lastPurchasePrice: price,
    lastImageUpdatedAt: undefined,
  }
  windows[index] = sold
  saveRegionWindows(region, windows)

  const updatedBuyer = (payment.walletAmount > 0 && adjustBalance(buyer.id, -payment.walletAmount)) || buyer
  if (sellerId) adjustBalance(sellerId, sellerNet)

  recordTransaction({
    windowId,
    windowCode: window.code,
    region,
    windowTitle: sold.title,
    fromOwner: sellerName,
    fromOwnerId: sellerId,
    toOwner: buyer.name,
    toOwnerId: buyer.id,
    amount: price,
    commissionRate: RESALE_COMMISSION_RATE,
    commissionAmount: commission,
    netSellerAmount: sellerNet,
    type: 'resale',
    verifiedCitizenId: buyer.citizenId,
    ...paymentFields(payment, now),
  })
  return { success: true, updatedWindow: sold, updatedBuyer }
}

/** List an owned window for resale (after 30 days, at 100 ฿ up to the price cap). */
export function listForResale(
  region: RegionId,
  windowId: number,
  user: User,
  price: number,
): Result<{ updatedWindow: WindowItem }> {
  const permission = checkPermission(user, region, 'sell')
  if (!permission.allowed) return denied(permission)

  const window = loadRegionWindows(region).find((w) => w.id === windowId)
  if (!window) return { success: false, error: 'ไม่พบหน้าต่าง' }
  if (window.ownerId !== user.id) return { success: false, error: 'คุณไม่ใช่เจ้าของหน้าต่างบานนี้' }

  const holding = getHoldingPeriod(window)
  if (!holding.isEligible) {
    return {
      success: false,
      error: `ตามเงื่อนไขข้อ 1: เจ้าของจะต้องถือครองหน้าต่างบานนี้ไม่ต่ำกว่า 1 เดือนขึ้นไป (30 วัน) จึงจะสามารถเปิดขายต่อได้ (ปัจจุบันถือครองมาแล้ว ${holding.daysHeld} วัน, ขาดอีก ${holding.daysRemaining} วัน)`,
    }
  }
  if (price < MIN_RESALE_PRICE) return { success: false, error: 'ราคาขายต่อต้องไม่ต่ำกว่า 100 ฿' }
  const cap = getPriceCap(window)
  if (cap.maxAllowedPrice !== null && price > cap.maxAllowedPrice) {
    return {
      success: false,
      error: `ไม่สามารถตั้งราคาเกิน ${cap.maxAllowedPrice.toLocaleString()} ฿ ได้ (${cap.ruleDescription})`,
    }
  }
  const updatedWindow = updateWindow(region, windowId, (w) => ({ ...w, status: 'for_resale', resalePrice: price }))!
  return { success: true, updatedWindow }
}

export function cancelResale(region: RegionId, windowId: number, user: User): Result<{ updatedWindow: WindowItem }> {
  const window = loadRegionWindows(region).find((w) => w.id === windowId)
  if (!window) return { success: false, error: 'ไม่พบหน้าต่าง' }
  if (window.ownerId !== user.id) return { success: false, error: 'คุณไม่ใช่เจ้าของหน้าต่างบานนี้' }
  const updatedWindow = updateWindow(region, windowId, (w) => ({ ...w, status: 'occupied', resalePrice: undefined }))!
  return { success: true, updatedWindow }
}

/** Free transfers were removed: every change of owner must go through resale (5% commission). */
export function transferWindow(): Result<{ updatedWindow: WindowItem }> {
  return {
    success: false,
    error:
      'ยกเลิกการโอนกรรมสิทธิ์แบบไม่มีค่าธรรมเนียมแล้ว: การเปลี่ยนเจ้าของทุกครั้งต้องผ่านระบบขายต่อ (หักค่าคอมมิชชั่น 5%)',
  }
}

export interface WindowEditInput extends Omit<WindowContentInput, 'imageUrl'> {
  /** Only set when the owner picked a new image. */
  imageUrl?: string
  caption?: string
  dailyNote?: string
}

/** Owner edit (once per 24 hours). A new image is added to the image history. */
export function editWindow(
  region: RegionId,
  windowId: number,
  user: User,
  input: WindowEditInput,
): Result<{ updatedWindow: WindowItem }> {
  const window = loadRegionWindows(region).find((w) => w.id === windowId)
  if (!window) return { success: false, error: 'ไม่พบหน้าต่าง' }
  if (window.ownerId !== user.id) return { success: false, error: 'คุณไม่ใช่เจ้าของหน้าต่างบานนี้' }
  const edit = getEditAvailability(window)
  if (!edit.canUpdate) {
    return {
      success: false,
      error: `แก้ไขได้วันละ 1 ครั้งเท่านั้น (แก้ไขครั้งถัดไปได้ในอีก ${edit.hoursRemaining} ชม. ${edit.minutesRemaining} นาที)`,
    }
  }
  const title = input.title.trim()
  if (!title) return { success: false, error: 'กรุณาระบุชื่อหน้าต่าง' }

  const now = nowIso()
  const imageChanged = !!input.imageUrl && input.imageUrl !== window.imageUrl
  const history = [...(window.imageUpdateHistory || [])]
  if (imageChanged) history.unshift({ date: now, imageUrl: input.imageUrl!, caption: input.caption?.trim() || 'อัปเดตรูปภาพ' })
  const note = input.dailyNote?.trim().slice(0, 80) || ''

  const updatedWindow = updateWindow(region, windowId, (w) => ({
    ...w,
    title,
    description: input.description.trim() || w.description,
    category: input.category,
    province: input.province || w.province,
    ownerContact: input.ownerContact?.trim() || undefined,
    externalLink: input.externalLink?.trim() || undefined,
    imageUrl: imageChanged ? input.imageUrl! : w.imageUrl,
    lastImageUpdatedAt: now,
    imageUpdateHistory: history,
    dailyNote: note ? { day: thaiDayKey(), text: note, at: now } : w.dailyNote,
  }))!
  return { success: true, updatedWindow }
}

export function likeWindow(region: RegionId, windowId: number): WindowItem | null {
  return updateWindow(region, windowId, (w) => ({
    ...w,
    likesCount: w.likesCount + 1,
    dailyLikes: { day: thaiDayKey(), count: likesToday(w) + 1 },
  }))
}

export function toggleFollow(region: RegionId, windowId: number, user: User): WindowItem | null {
  return updateWindow(region, windowId, (w) => {
    const followers = w.followerIds || []
    return {
      ...w,
      followerIds: followers.includes(user.id) ? followers.filter((id) => id !== user.id) : [...followers, user.id],
    }
  })
}

// ---------------------------------------------------------------- demo shortcuts

/** Demo only: lets the owner edit again right away by back-dating the last edit. */
export function demoSkipEditCooldown(region: RegionId, windowId: number): WindowItem | null {
  return updateWindow(region, windowId, (w) => ({
    ...w,
    lastImageUpdatedAt: new Date(Date.now() - DAY_MS - 60000).toISOString(),
  }))
}

/** Demo only: pretends the window was acquired `days` days ago (to test the 30-day rule). */
export function demoBackdateOwnership(region: RegionId, windowId: number, days: number): WindowItem | null {
  const at = new Date(Date.now() - days * DAY_MS).toISOString()
  return updateWindow(region, windowId, (w) => ({ ...w, claimedAt: at, ownerChangedAt: at }))
}

/** Wipes all demo data and starts again as the first-time user. */
export function resetAppData(): { user: User; transactions: Transaction[] } {
  storage.clearAppData()
  const users = [{ ...NEW_USER, createdAt: nowIso() }, ...DEMO_USERS.slice(1)]
  saveUsers(users)
  saveCurrentUser(users[0])
  storage.set(TRANSACTIONS_KEY, JSON.stringify([]))
  saveActiveRegion('thailand')
  for (const region of REGION_IDS) saveRegionWindows(region, createInitialWindows(region))
  return { user: users[0], transactions: [] }
}
