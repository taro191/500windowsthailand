// Admin-only actions (demo, localStorage). Every change is written to the audit log.
import type { PlatformSettings, RegionId, User, WindowItem } from '@/types'
import { REGION_IDS } from '@/data/regions'
import { createEmptyWindows } from '@/data/seedWindows'
import { loadPromoRequests, updatePromoRequest, type PromoAd, type PromoRequest } from './promo'
import { adjustBalance, loadRegionWindows, loadUsers, recordTransaction, saveRegionWindows, saveUsers } from './store'
import { saveSettings } from './settings'

const AUDIT_KEY = 'thai_windows_v11_clean_audit_log'
const ACTIVE_ADS_KEY = 'kapsulep_promo_active'

export interface AuditEntry {
  id: string
  at: string
  adminId: string
  adminName: string
  action: string
  detail: string
}

export function loadAuditLog(): AuditEntry[] {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]')
  } catch {
    return []
  }
}

function audit(admin: User, action: string, detail: string) {
  const entry: AuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    adminId: admin.id,
    adminName: admin.name,
    action,
    detail,
  }
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify([entry, ...loadAuditLog()].slice(0, 500)))
  } catch {
    /* ignore */
  }
}

/** All 3,500 windows across the seven boards, in id order per region. */
export function loadAllWindows(): WindowItem[] {
  return REGION_IDS.flatMap((region) => loadRegionWindows(region))
}

// ---------------------------------------------------------------- settings

export function updateSettings(admin: User, settings: PlatformSettings, what: string) {
  saveSettings(settings)
  audit(admin, 'แก้ไขการตั้งค่า', what)
}

// ---------------------------------------------------------------- windows & content

/** Content moderation: removes the image and text (rule 5) but keeps the owner. */
export function takeDownContent(admin: User, region: RegionId, windowId: number, reason: string): WindowItem | null {
  const windows = loadRegionWindows(region)
  const index = windows.findIndex((w) => w.id === windowId)
  if (index === -1) return null
  const w = windows[index]
  windows[index] = {
    ...w,
    imageUrl: '',
    title: `เนื้อหาถูกระงับโดยผู้ดูแลระบบ (${w.code})`,
    description: `เนื้อหาของบานนี้ถูกถอดออกเนื่องจากขัดต่อเงื่อนไขการใช้งาน: ${reason}`,
    externalLink: undefined,
    dailyNote: undefined,
  }
  saveRegionWindows(region, windows)
  audit(admin, 'ถอดเนื้อหาบาน', `${w.code} · ${reason}`)
  return windows[index]
}

/** Returns a window to the pool as an empty, available window (ownership is removed). */
export function releaseWindow(admin: User, region: RegionId, windowId: number, reason: string): WindowItem | null {
  const windows = loadRegionWindows(region)
  const index = windows.findIndex((w) => w.id === windowId)
  if (index === -1) return null
  const previous = windows[index]
  const empty = createEmptyWindows(region).find((w) => w.id === windowId)!
  windows[index] = {
    ...empty,
    previousOwnerId: previous.ownerId || previous.previousOwnerId,
    previousOwnerHistory: previous.previousOwnerHistory,
  }
  saveRegionWindows(region, windows)
  audit(admin, 'คืนบานเป็นบานว่าง', `${previous.code} (เจ้าของเดิม ${previous.ownerName}) · ${reason}`)
  return windows[index]
}

// ---------------------------------------------------------------- users

function updateUserById(userId: string, change: (u: User) => User): User | null {
  const users = loadUsers()
  const index = users.findIndex((u) => u.id === userId)
  if (index === -1) return null
  users[index] = change(users[index])
  saveUsers(users)
  return users[index]
}

export function setUserSuspended(admin: User, userId: string, suspended: boolean): User | null {
  const user = updateUserById(userId, (u) => ({ ...u, suspended }))
  if (user) audit(admin, suspended ? 'ระงับบัญชี' : 'ยกเลิกการระงับบัญชี', user.name)
  return user
}

export function revokeKyc(admin: User, userId: string): User | null {
  const user = updateUserById(userId, (u) => ({ ...u, isVerified: false, verifiedAt: undefined }))
  if (user) audit(admin, 'เพิกถอนการยืนยันตัวตน (KYC)', user.name)
  return user
}

// ---------------------------------------------------------------- promo requests

function loadActiveAds(): (PromoAd & { requestId?: string })[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_ADS_KEY) || '[]')
  } catch {
    return []
  }
}

/**
 * Decides a pending request. Approving publishes the ad on the board (windows 481–486)
 * and keeps the payment as revenue; rejecting refunds the full amount to the wallet.
 */
export function decidePromoRequest(
  admin: User,
  requestId: string,
  decision: 'approved' | 'rejected',
): { success: true; refunded?: number } | { success: false; error: string } {
  const request = loadPromoRequests().find((r) => r.id === requestId)
  if (!request) return { success: false, error: 'ไม่พบคำขอ' }
  if (request.status !== 'pending') return { success: false, error: 'คำขอนี้ถูกพิจารณาไปแล้ว' }

  let refunded: number | undefined
  let refund: PromoRequest['refund']
  if (decision === 'rejected' && request.payment) {
    const amount = request.payment.amount
    const credited = adjustBalance(request.userId, amount)
    if (!credited) return { success: false, error: 'ไม่พบบัญชีผู้ขอ คืนเงินไม่ได้' }
    const tx = recordTransaction({
      windowId: 0,
      windowCode: 'REFUND',
      region: 'thailand',
      windowTitle: `คืนค่าโปรโมท "${request.brand}" (ไม่อนุมัติ)`,
      fromOwner: 'พื้นที่โปรโมท 500 Windows',
      fromOwnerId: 'platform',
      toOwner: credited.name,
      toOwnerId: credited.id,
      amount,
      type: 'refund',
      walletAmount: amount,
      externalAmount: 0,
    })
    refunded = amount
    refund = { amount, at: new Date().toISOString(), transactionId: tx.id }
  }
  updatePromoRequest(requestId, (r) => ({ ...r, status: decision, refund }))

  const ads = loadActiveAds().filter((ad) => ad.requestId !== requestId)
  if (decision === 'approved') {
    ads.push({ requestId, brand: request.brand, tagline: request.tagline, link: request.link, image: request.image, size: request.size })
  }
  localStorage.setItem(ACTIVE_ADS_KEY, JSON.stringify(ads))
  audit(
    admin,
    decision === 'approved' ? 'อนุมัติคำขอโปรโมท' : 'ไม่อนุมัติคำขอโปรโมท',
    refunded ? `${request.brand} · คืนเงิน ฿${refunded.toLocaleString()} เข้ากระเป๋า` : request.brand,
  )
  return { success: true, refunded }
}
