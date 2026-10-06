// Platform settings edited on the admin page: resale price caps, payment channels
// and top-up limits. Stored in localStorage for the demo; components read them
// through useSettings() so changes apply immediately.
import { useSyncExternalStore } from 'react'
import type { PaymentChannel, PaymentChannelType, PlatformSettings, PriceCapTier } from '@/types'

const SETTINGS_KEY = 'thai_windows_v11_clean_settings'

export const CHANNEL_TYPE_LABELS: Record<PaymentChannelType, string> = {
  promptpay: 'พร้อมเพย์ (PromptPay QR)',
  bank: 'โอนผ่านบัญชีธนาคาร',
  truemoney: 'TrueMoney Wallet',
  card: 'บัตรเครดิต / เดบิต (Payment Gateway)',
}

/** Channels that are confirmed by uploading a transfer slip (card goes through a gateway). */
export const SLIP_CHANNEL_TYPES: PaymentChannelType[] = ['promptpay', 'bank', 'truemoney']

export const DEFAULT_SETTINGS: PlatformSettings = {
  priceCaps: {
    unusedMultiplier: 10,
    usedTiers: [
      { id: 'tier-1', upToYears: 1, multiplier: 15 },
      { id: 'tier-2', upToYears: 2, multiplier: 20 },
      { id: 'tier-3', upToYears: null, multiplier: null },
    ],
  },
  paymentChannels: [
    {
      id: 'ch-promptpay',
      type: 'promptpay',
      name: 'พร้อมเพย์ บริษัท',
      enabled: true,
      accountName: 'บจก. แคปซูลเลพ 500 หน้าต่างประเทศไทย',
      accountNumber: '0-1055-67000-00-0',
    },
    {
      id: 'ch-kbank',
      type: 'bank',
      name: 'ธนาคารกสิกรไทย',
      enabled: true,
      bankCode: 'kbank',
      accountName: 'บจก. แคปซูลเลพ 500 หน้าต่างประเทศไทย',
      accountNumber: '189-2-50012-3',
    },
    {
      id: 'ch-scb',
      type: 'bank',
      name: 'ธนาคารไทยพาณิชย์',
      enabled: true,
      bankCode: 'scb',
      accountName: 'บจก. แคปซูลเลพ 500 หน้าต่างประเทศไทย',
      accountNumber: '[เลขบัญชี SCB]',
    },
    {
      id: 'ch-truemoney',
      type: 'truemoney',
      name: 'TrueMoney Wallet',
      enabled: true,
      accountName: 'Kapsulep',
      accountNumber: '[เบอร์ TrueMoney]',
    },
    {
      id: 'ch-card',
      type: 'card',
      name: 'บัตรเครดิต / เดบิต',
      enabled: true,
      note: 'ผ่าน Payment Gateway (ยังไม่ได้เลือกผู้ให้บริการ)',
    },
  ],
  topUp: {
    min: 100,
    max: 50000,
    presets: [500, 1000, 2000, 5000],
  },
}

let cached: PlatformSettings | null = null
const listeners = new Set<() => void>()

export function loadSettings(): PlatformSettings {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    cached = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    cached = DEFAULT_SETTINGS
  }
  return cached!
}

export function saveSettings(settings: PlatformSettings) {
  cached = { ...settings, updatedAt: new Date().toISOString() }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(cached))
  } catch {
    /* storage blocked: keep the in-memory copy */
  }
  listeners.forEach((listener) => listener())
}

export function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY)
  } catch {
    /* ignore */
  }
  cached = DEFAULT_SETTINGS
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Current settings; re-renders when the admin saves. */
export function useSettings(): PlatformSettings {
  return useSyncExternalStore(subscribe, loadSettings, loadSettings)
}

export const enabledChannels = (settings: PlatformSettings = loadSettings()): PaymentChannel[] =>
  settings.paymentChannels.filter((c) => c.enabled)

// ---------------------------------------------------------------- price cap tiers

/** Tiers in age order with the open-ended tier last. */
export function sortTiers(tiers: PriceCapTier[]): PriceCapTier[] {
  return [...tiers].sort((a, b) => (a.upToYears ?? Infinity) - (b.upToYears ?? Infinity))
}

/** Age range of each tier, e.g. "อายุ 1–2 ปี" or "อายุ 2 ปีขึ้นไป". */
export function tierAgeLabel(tiers: PriceCapTier[], index: number): string {
  const sorted = sortTiers(tiers)
  const from = index === 0 ? 0 : sorted[index - 1].upToYears ?? 0
  const to = sorted[index].upToYears
  if (to === null) return `อายุ ${formatYears(from)} ขึ้นไป`
  if (from === 0) return `อายุไม่ถึง ${formatYears(to)}`
  return `อายุ ${formatYears(from)}–${formatYears(to)}`
}

export const multiplierLabel = (multiplier: number | null) =>
  multiplier === null ? 'ตามความต้องการจริงของตลาด (ไม่มีเพดาน)' : `สูงสุด ${multiplier} เท่า`

function formatYears(years: number): string {
  if (years < 1) return `${Math.round(years * 12)} เดือน`
  return `${Number.isInteger(years) ? years : years.toFixed(1)} ปี`
}

/** Returns an error message, or null when the tiers are valid. */
export function validateTiers(tiers: PriceCapTier[]): string | null {
  if (tiers.length === 0) return 'ต้องมีอย่างน้อย 1 ช่วงอายุ'
  const sorted = sortTiers(tiers)
  if (sorted[sorted.length - 1].upToYears !== null) return 'ช่วงสุดท้ายต้องเป็น "ขึ้นไป" (ไม่มีอายุสิ้นสุด)'
  if (sorted.filter((t) => t.upToYears === null).length > 1) return 'มีช่วง "ขึ้นไป" ได้เพียงช่วงเดียว'
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]
    if (t.upToYears !== null && !(t.upToYears > 0)) return 'อายุสิ้นสุดของแต่ละช่วงต้องมากกว่า 0'
    if (i > 0 && t.upToYears !== null && t.upToYears === sorted[i - 1].upToYears) return 'อายุสิ้นสุดของแต่ละช่วงต้องไม่ซ้ำกัน'
    if (t.multiplier !== null && !(t.multiplier >= 1)) return 'ตัวคูณเพดานราคาต้องไม่น้อยกว่า 1 เท่า'
  }
  return null
}
