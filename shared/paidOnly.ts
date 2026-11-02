// Window codes an admin keeps for paying owners: a free trial can't start on them.
// Written as single codes or ranges in one text box, e.g. "KAP-TH-008, KAP-TH-088..099, KAP-NE-TH-001..050".
import { REGIONS } from './regions'

export interface PaidOnlyRange {
  prefix: string
  from: number
  to: number
}

const PREFIXES = REGIONS.map((r) => r.codePrefix).sort((a, b) => b.length - a.length)
const MAX_NUM = 500

/** "KAP-NE-TH-088" → { prefix: 'KAP-NE-TH', num: 88 }; null when not a window code of this system. */
export function splitCode(code: string): { prefix: string; num: number } | null {
  const m = code.trim().toUpperCase().match(/^(.+)-(\d{3})$/)
  if (!m || !PREFIXES.includes(m[1])) return null
  const num = Number(m[2])
  return num >= 1 && num <= MAX_NUM ? { prefix: m[1], num } : null
}

/** Parses the admin's list; `error` names the first entry that isn't a valid code or range. */
export function parsePaidOnly(text: string): { ranges: PaidOnlyRange[]; error?: string } {
  const ranges: PaidOnlyRange[] = []
  for (const raw of text.split(/[\s,;]+/).filter(Boolean)) {
    const [a, b] = raw.split('..')
    const start = splitCode(a)
    if (!start) return { ranges, error: `รหัส "${raw}" ไม่ถูกต้อง (ตัวอย่าง KAP-TH-008 หรือ KAP-TH-088..099)` }
    if (b === undefined) {
      ranges.push({ prefix: start.prefix, from: start.num, to: start.num })
      continue
    }
    // The end of a range may be the full code or just its number ("KAP-TH-088..099").
    const end = /^\d{3}$/.test(b) ? { prefix: start.prefix, num: Number(b) } : splitCode(b)
    if (!end || end.prefix !== start.prefix || end.num < start.num || end.num > MAX_NUM) return { ranges, error: `ช่วง "${raw}" ไม่ถูกต้อง (ต้องอยู่ในกลุ่มเดียวกัน และเลขเริ่มไม่เกินเลขท้าย)` }
    ranges.push({ prefix: start.prefix, from: start.num, to: end.num })
  }
  return { ranges }
}

// The board asks for every tile, so the last parsed list is kept.
let cached = { text: '', ranges: [] as PaidOnlyRange[] }

/** Whether a free trial is refused on this window code. */
export function isPaidOnly(code: string, text: string): boolean {
  if (!text.trim()) return false
  const c = splitCode(code)
  if (!c) return false
  if (cached.text !== text) cached = { text, ranges: parsePaidOnly(text).ranges }
  return cached.ranges.some((r) => r.prefix === c.prefix && c.num >= r.from && c.num <= r.to)
}

/** How many window codes the list covers (duplicates counted once). */
export function paidOnlyCount(text: string): number {
  const seen = new Set<string>()
  for (const r of parsePaidOnly(text).ranges) for (let n = r.from; n <= r.to; n++) seen.add(`${r.prefix}-${n}`)
  return seen.size
}
