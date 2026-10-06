/** Thailand is UTC+7 with no daylight saving. */
export const THAI_OFFSET_MS = 7 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000
export const ROTATION_INTERVAL_MS = 6 * 60 * 60 * 1000

/** Days of the month when the board returns to the standard 1–500 order for 24 hours. */
export const STANDARD_ORDER_DAYS = [1, 15, 25]

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** The current calendar day in Bangkok as `YYYY-MM-DD`. Daily likes and notes reset on this key. */
export function thaiDayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** e.g. `4 ต.ค. 2569`, from a Date already shifted to Thai time and read with UTC getters. */
function formatThaiShortDate(shifted: Date): string {
  return `${shifted.getUTCDate()} ${THAI_MONTHS_SHORT[shifted.getUTCMonth()]} ${shifted.getUTCFullYear() + 543}`
}

export interface RotationCycle {
  /** Stable key for the current cycle; the board order is seeded from it. Ends in `-standard` on 1/15/25. */
  cycleKey: string
  thaiCycleTitle: string
  thaiNextCycleTitle: string
  remainingText: string
  isStandard: boolean
}

/**
 * Board positions shuffle every 6 hours (00, 06, 12, 18 Thai time), except on the
 * 1st, 15th and 25th when the whole day shows the standard 1–500 order.
 */
export function getRotationCycle(now: Date = new Date()): RotationCycle {
  const thaiNow = new Date(now.getTime() + THAI_OFFSET_MS)
  const year = thaiNow.getUTCFullYear()
  const month = thaiNow.getUTCMonth()
  const day = thaiNow.getUTCDate()
  const isStandardDay = (d: number) => STANDARD_ORDER_DAYS.includes(d)
  const isStandard = isStandardDay(day)
  const slot = Math.floor(thaiNow.getUTCHours() / 6)
  const dateKey = `${year}-${pad2(month + 1)}-${pad2(day)}`

  const cycleKey = isStandard ? `${dateKey}-standard` : `${dateKey}-s${slot}`
  const cycleStart = isStandard
    ? Date.UTC(year, month, day, 0, 0, 0) - THAI_OFFSET_MS
    : Date.UTC(year, month, day, slot * 6, 0, 0) - THAI_OFFSET_MS
  const cycleEnd = isStandard
    ? Date.UTC(year, month, day + 1, 0, 0, 0) - THAI_OFFSET_MS
    : cycleStart + ROTATION_INTERVAL_MS
  const thaiNext = new Date(cycleEnd + THAI_OFFSET_MS)
  const nextIsStandard = isStandardDay(thaiNext.getUTCDate())

  const thaiCycleTitle = isStandard
    ? `${formatThaiShortDate(thaiNow)} · ตำแหน่งมาตรฐาน 1–500`
    : `${formatThaiShortDate(thaiNow)} · รอบ ${pad2(slot * 6)}:00–${pad2(slot * 6 + 5)}:59 น.`
  const thaiNextCycleTitle = `${pad2(thaiNext.getUTCHours())}:00 น. ${formatThaiShortDate(thaiNext)} ${
    nextIsStandard ? '(กลับตำแหน่งมาตรฐาน)' : '(สุ่มสลับ)'
  }`
  const remainingMinutes = Math.ceil(Math.max(0, cycleEnd - now.getTime()) / 60000)

  return {
    cycleKey,
    thaiCycleTitle,
    thaiNextCycleTitle,
    remainingText: `เหลือ ${Math.floor(remainingMinutes / 60)} ชม. ${remainingMinutes % 60} นาที`,
    isStandard,
  }
}

/** Index of the 6-hour block (Thai time) containing `time`, plus an optional offset. */
export function sixHourBlockIndex(time: number = Date.now(), offset = 0): number {
  return Math.floor((time + THAI_OFFSET_MS) / ROTATION_INTERVAL_MS) + offset
}

/** Label and time left for the 6-hour block containing `time` (used for promo rounds). */
export function sixHourBlock(time: number = Date.now(), offset = 0) {
  const idx = sixHourBlockIndex(time, offset)
  const start = idx * ROTATION_INTERVAL_MS - THAI_OFFSET_MS
  const startHour = new Date(start + THAI_OFFSET_MS).getUTCHours()
  return {
    idx,
    label: `${pad2(startHour)}:00–${pad2((startHour + 6) % 24)}:00 น.`,
    remainingMs: start + ROTATION_INTERVAL_MS - time,
  }
}
