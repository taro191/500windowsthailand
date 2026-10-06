// Time-based ownership rules: one edit per day, 30-day minimum holding, resale price caps
// (caps are configured on the admin page, see settings.ts). Used by the web app and the API.
import type { PlatformSettings, WindowItem } from './types'
import { DAY_MS } from './thaiTime'
import { multiplierLabel, sortTiers, tierAgeLabel } from './settings'

export const CLAIM_PRICE = 500
export const MIN_HOLDING_DAYS = 30
export const MIN_RESALE_PRICE = 100
export const RESALE_COMMISSION_RATE = 0.05

export interface EditAvailability {
  canUpdate: boolean
  hoursRemaining: number
  minutesRemaining: number
  nextEditAt?: string
}

/** Owners may change their image or text once every 24 hours. */
export function getEditAvailability(window: WindowItem): EditAvailability {
  const open: EditAvailability = { canUpdate: true, hoursRemaining: 0, minutesRemaining: 0 }
  if (window.status === 'available' || !window.lastImageUpdatedAt) return open
  const nextEdit = new Date(window.lastImageUpdatedAt).getTime() + DAY_MS
  const msLeft = nextEdit - Date.now()
  if (msLeft <= 0) return open
  const minutesLeft = Math.ceil(msLeft / 60000)
  return {
    canUpdate: false,
    hoursRemaining: Math.floor(minutesLeft / 60),
    minutesRemaining: minutesLeft % 60,
    nextEditAt: new Date(nextEdit).toISOString(),
  }
}

export interface HoldingPeriod {
  isEligible: boolean
  daysHeld: number
  daysRemaining: number
  acquiredAt: string
}

/** A window can be put up for resale only after the owner has held it for 30 days. */
export function getHoldingPeriod(window: WindowItem): HoldingPeriod {
  if (window.status === 'available') return { isEligible: true, daysHeld: 0, daysRemaining: 0, acquiredAt: '' }
  const acquiredAt = window.ownerChangedAt || window.claimedAt || new Date().toISOString()
  const daysHeld = Math.max(0, Math.floor((Date.now() - new Date(acquiredAt).getTime()) / DAY_MS))
  return {
    isEligible: daysHeld >= MIN_HOLDING_DAYS,
    daysHeld,
    daysRemaining: Math.max(0, MIN_HOLDING_DAYS - daysHeld),
    acquiredAt,
  }
}

export interface PriceCap {
  basePrice: number
  isUsed: boolean
  ageDays: number
  ageYears: number
  /** null = no cap (used and older than 2 years). */
  maxMultiplier: number | null
  maxAllowedPrice: number | null
  tierLabel: string
  ruleDescription: string
}

/** A window counts as "used" once it has had content, an image history, a daily note or any like. */
function hasBeenUsed(window: WindowItem): boolean {
  return !!(
    window.imageUpdateHistory?.length ||
    (window.imageUrl && !window.title.startsWith('หน้าต่างว่าง')) ||
    window.dailyNote ||
    window.likesCount > 0
  )
}

/** Cap from the admin settings: one rule for unused windows, age tiers for used ones. */
function basePriceCap(window: WindowItem, settings: PlatformSettings): PriceCap {
  const basePrice = window.claimPrice || CLAIM_PRICE
  const since = window.claimedAt || window.ownerChangedAt || new Date().toISOString()
  const ageDays = Math.floor(Math.max(0, Date.now() - new Date(since).getTime()) / DAY_MS)
  const ageYears = ageDays / 365
  const common = { basePrice, ageDays, ageYears }
  const describe = (tier: string, multiplier: number | null) => {
    const max = multiplier === null ? null : basePrice * multiplier
    return {
      maxMultiplier: multiplier,
      maxAllowedPrice: max,
      tierLabel: `${tier} (${multiplierLabel(multiplier)})`,
      ruleDescription:
        max === null
          ? `หน้าต่าง${tier} สามารถตั้งราคาตามความต้องการจริงของตลาดได้โดยไม่มีเพดานจำกัด`
          : `หน้าต่าง${tier} ตั้งราคาได้ไม่เกิน ${multiplier} เท่าของราคาตั้งต้น (ไม่เกิน ฿${max.toLocaleString()})`,
    }
  }

  if (!hasBeenUsed(window)) {
    return { ...common, isUsed: false, ...describe('ไม่เคยผ่านการใช้งาน', settings.priceCaps.unusedMultiplier) }
  }
  const tiers = sortTiers(settings.priceCaps.usedTiers)
  const index = tiers.findIndex((t) => t.upToYears === null || ageYears < t.upToYears)
  const tierIndex = index === -1 ? tiers.length - 1 : index
  const tier = tiers[tierIndex]
  return {
    ...common,
    isUsed: true,
    ...describe(`ผ่านการใช้งาน ${tierAgeLabel(tiers, tierIndex)}`, tier ? tier.multiplier : null),
  }
}

/**
 * Resale price cap. If the owner paid more than the tier cap, the cap is raised to
 * what they paid so they are never forced to sell at a loss.
 */
export function getPriceCap(window: WindowItem, settings: PlatformSettings): PriceCap {
  const cap = basePriceCap(window, settings)
  const paid = window.lastPurchasePrice || 0
  if (cap.maxAllowedPrice !== null && paid > cap.maxAllowedPrice) {
    return {
      ...cap,
      maxAllowedPrice: paid,
      ruleDescription: `${cap.ruleDescription} · ปรับเพดานขึ้นเป็นราคาที่คุณซื้อมา (฿${paid.toLocaleString()}) เพื่อไม่ให้ขายต่อแล้วติดกับดักราคา`,
    }
  }
  return cap
}
