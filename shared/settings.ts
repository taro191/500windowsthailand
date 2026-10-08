// Platform settings edited on the admin page: resale price caps, payment channels, top-up
// limits and the owner edit policy. Defaults and validation are shared by the web app and the API.
import type { PaymentChannel, PaymentChannelType, PlatformSettings, PriceCapTier } from './types'

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
  editPolicy: {
    freeEditsPerDay: 1,
    paidEditPrice: 0,
  },
  signupBonus: {
    amount: 0,
    startsAt: null,
    endsAt: null,
  },
}

/** The bonus a new account gets right now (0 when off or outside the period). */
export function activeSignupBonus({ signupBonus }: PlatformSettings, now: Date = new Date()): number {
  const { amount, startsAt, endsAt } = signupBonus ?? DEFAULT_SETTINGS.signupBonus
  if (!(amount > 0)) return 0
  if (startsAt && now.getTime() < Date.parse(startsAt)) return 0
  if (endsAt && now.getTime() >= Date.parse(endsAt)) return 0
  return amount
}

/** e.g. "แก้ไขรูปภาพ/ข้อความได้ฟรีวันละ 1 ครั้ง (ครั้งต่อไป ฿50)". */
export function editPolicyLabel({ freeEditsPerDay, paidEditPrice }: PlatformSettings['editPolicy']): string {
  const free = freeEditsPerDay > 0 ? `แก้ไขรูปภาพ/ข้อความได้ฟรีวันละ ${freeEditsPerDay} ครั้ง` : 'แก้ไขรูปภาพ/ข้อความได้'
  if (paidEditPrice <= 0) return free
  return freeEditsPerDay > 0 ? `${free} (ครั้งต่อไป ฿${paidEditPrice.toLocaleString()})` : `${free} ครั้งละ ฿${paidEditPrice.toLocaleString()}`
}

export const enabledChannels = (settings: PlatformSettings): PaymentChannel[] =>
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

const CHANNEL_TYPES = Object.keys(CHANNEL_TYPE_LABELS) as PaymentChannelType[]
const isMultiplier = (value: unknown) => value === null || (typeof value === 'number' && value >= 1)

/** Checks a whole settings object (as sent by the admin page). Returns an error message or null. */
export function validateSettings(settings: PlatformSettings): string | null {
  const { priceCaps, paymentChannels, topUp, editPolicy } = settings ?? ({} as PlatformSettings)
  if (!priceCaps || !Array.isArray(priceCaps.usedTiers)) return 'ข้อมูลเพดานราคาไม่ครบ'
  if (!isMultiplier(priceCaps.unusedMultiplier)) return 'ตัวคูณเพดานราคาต้องไม่น้อยกว่า 1 เท่า'
  const tierError = validateTiers(priceCaps.usedTiers)
  if (tierError) return tierError

  if (!Array.isArray(paymentChannels)) return 'ข้อมูลช่องทางรับเงินไม่ครบ'
  const ids = new Set<string>()
  for (const c of paymentChannels) {
    if (!c.id || ids.has(c.id)) return 'รหัสช่องทางรับเงินต้องไม่ว่างและไม่ซ้ำกัน'
    ids.add(c.id)
    if (!CHANNEL_TYPES.includes(c.type)) return `ประเภทช่องทางไม่ถูกต้อง: ${c.type}`
    if (!c.name?.trim()) return 'กรุณาระบุชื่อช่องทางรับเงิน'
    if (c.type !== 'card' && c.enabled && !c.accountNumber?.trim()) return `กรุณาระบุเลขบัญชี/หมายเลขของ "${c.name}"`
  }
  if (!paymentChannels.some((c) => c.enabled)) return 'ต้องเปิดใช้อย่างน้อย 1 ช่องทาง'

  if (!topUp || !Number.isInteger(topUp.min) || !Number.isInteger(topUp.max)) return 'ยอดเติมเงินต้องเป็นจำนวนเต็ม'
  if (topUp.min < 1 || topUp.max < topUp.min) return 'ยอดเติมสูงสุดต้องไม่น้อยกว่ายอดขั้นต่ำ (และขั้นต่ำอย่างน้อย ฿1)'
  if (!Array.isArray(topUp.presets) || topUp.presets.some((p) => !Number.isInteger(p) || p < topUp.min || p > topUp.max))
    return 'ปุ่มยอดลัดต้องอยู่ระหว่างยอดขั้นต่ำและสูงสุด'

  if (!editPolicy) return 'ข้อมูลสิทธิ์แก้ไขบานไม่ครบ'
  const { freeEditsPerDay, paidEditPrice } = editPolicy
  if (!Number.isInteger(freeEditsPerDay) || freeEditsPerDay < 0 || freeEditsPerDay > 100)
    return 'จำนวนครั้งที่แก้ไขฟรีต่อวันต้องเป็นจำนวนเต็ม 0–100'
  if (!Number.isInteger(paidEditPrice) || paidEditPrice < 0 || paidEditPrice > 1_000_000)
    return 'ค่าแก้ไขเพิ่มต้องเป็นจำนวนเต็ม 0–1,000,000 บาท'
  if (freeEditsPerDay === 0 && paidEditPrice === 0) return 'ต้องให้แก้ไขฟรีอย่างน้อย 1 ครั้งต่อวัน หรือกำหนดค่าแก้ไขเพิ่ม'

  const { signupBonus } = settings
  if (!signupBonus) return 'ข้อมูลโบนัสสมัครสมาชิกไม่ครบ'
  if (!Number.isInteger(signupBonus.amount) || signupBonus.amount < 0 || signupBonus.amount > 1_000_000)
    return 'ยอดโบนัสต้องเป็นจำนวนเต็ม 0–1,000,000 บาท'
  const isDate = (value: string | null) => value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
  if (!isDate(signupBonus.startsAt) || !isDate(signupBonus.endsAt)) return 'วันเวลาเริ่ม/สิ้นสุดโบนัสไม่ถูกต้อง'
  if (signupBonus.startsAt && signupBonus.endsAt && Date.parse(signupBonus.endsAt) <= Date.parse(signupBonus.startsAt))
    return 'วันเวลาสิ้นสุดโบนัสต้องหลังวันเวลาเริ่ม'
  return null
}
