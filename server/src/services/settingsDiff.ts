// Human-readable list of what changed between two versions of the platform settings,
// for the LINE alert sent to the finance admin when an admin saves a settings page.
import type { PaymentChannel, PlatformSettings } from '@shared/types'
import { multiplierLabel, sortTiers, tierAgeLabel } from '@shared/settings'

const baht = (n: number) => `${n.toLocaleString()} บาท`
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ไม่กำหนด')

const RULES: [keyof PlatformSettings['rules'], string, (n: number) => string][] = [
  ['claimPrice', 'ราคาจับจองบาน', baht],
  ['commissionPercent', 'ค่าคอมมิชชั่นขายต่อ', (n) => `${n}%`],
  ['minHoldingDays', 'ระยะถือครองขั้นต่ำก่อนขายต่อ', (n) => `${n} วัน`],
  ['minResalePrice', 'ราคาขายต่อขั้นต่ำ', baht],
  ['promoPricePerWindowRound', 'ราคาโปรโมท (ต่อบาน/รอบ)', baht],
]

/** "กสิกรไทย 240-2-76668-1 (บรรพต ชิณสิทธิ์)" */
const channelText = (c: PaymentChannel) => [c.name, c.accountNumber, c.accountName && `(${c.accountName})`].filter(Boolean).join(' ')

function channelLines(before: PaymentChannel[], after: PaymentChannel[]): string[] {
  const lines: string[] = []
  const old = new Map(before.map((c) => [c.id, c]))
  const now = new Map(after.map((c) => [c.id, c]))
  for (const c of after) {
    const prev = old.get(c.id)
    if (!prev) {
      lines.push(`• เพิ่มช่องทาง: ${channelText(c)}${c.enabled ? '' : ' (ปิดอยู่)'}`)
      continue
    }
    if (prev.enabled !== c.enabled) lines.push(`• ${c.enabled ? 'เปิด' : 'ปิด'}ช่องทาง: ${c.name}`)
    const fields: [keyof PaymentChannel, string][] = [
      ['name', 'ชื่อ'],
      ['accountNumber', 'เลขบัญชี'],
      ['accountName', 'ชื่อบัญชี'],
      ['bankCode', 'ธนาคาร'],
      ['note', 'หมายเหตุ'],
    ]
    for (const [key, label] of fields) {
      if ((prev[key] ?? '') !== (c[key] ?? '')) lines.push(`• ${c.name} ${label}: ${prev[key] || '-'} → ${c[key] || '-'}`)
    }
  }
  for (const c of before) if (!now.has(c.id)) lines.push(`• ลบช่องทาง: ${channelText(c)}`)
  return lines
}

function capLines(before: PlatformSettings['priceCaps'], after: PlatformSettings['priceCaps']): string[] {
  const lines: string[] = []
  if (before.unusedMultiplier !== after.unusedMultiplier) {
    lines.push(`• เพดานบานที่ยังไม่ถูกใช้: ${multiplierLabel(before.unusedMultiplier)} → ${multiplierLabel(after.unusedMultiplier)}`)
  }
  if (!same(sortTiers(before.usedTiers), sortTiers(after.usedTiers))) {
    const describe = (tiers: PlatformSettings['priceCaps']['usedTiers']) => {
      const sorted = sortTiers(tiers)
      return sorted.map((t, i) => `${tierAgeLabel(sorted, i)} ${multiplierLabel(t.multiplier)}`).join(', ')
    }
    lines.push(`• เพดานบานที่ผ่านการใช้งาน: ${describe(before.usedTiers)} → ${describe(after.usedTiers)}`)
  }
  return lines
}

/** Every change between the two settings, one line each (empty when nothing changed). */
export function settingsChanges(before: PlatformSettings, after: PlatformSettings): string[] {
  const lines: string[] = []
  for (const [key, label, show] of RULES) {
    if (before.rules[key] !== after.rules[key]) lines.push(`• ${label}: ${show(before.rules[key])} → ${show(after.rules[key])}`)
  }
  lines.push(...channelLines(before.paymentChannels, after.paymentChannels))
  lines.push(...capLines(before.priceCaps, after.priceCaps))

  if (before.topUp.min !== after.topUp.min) lines.push(`• ยอดเติมเงินขั้นต่ำ: ${baht(before.topUp.min)} → ${baht(after.topUp.min)}`)
  if (before.topUp.max !== after.topUp.max) lines.push(`• ยอดเติมเงินสูงสุด: ${baht(before.topUp.max)} → ${baht(after.topUp.max)}`)
  if (!same(before.topUp.presets, after.topUp.presets)) {
    lines.push(`• ปุ่มยอดเติมเงิน: ${before.topUp.presets.join(', ') || '-'} → ${after.topUp.presets.join(', ') || '-'}`)
  }

  if (before.editPolicy.freeEditsPerDay !== after.editPolicy.freeEditsPerDay) {
    lines.push(`• แก้ไขบานฟรีต่อวัน: ${before.editPolicy.freeEditsPerDay} → ${after.editPolicy.freeEditsPerDay} ครั้ง`)
  }
  if (before.editPolicy.paidEditPrice !== after.editPolicy.paidEditPrice) {
    lines.push(`• ค่าแก้ไขบานเพิ่ม: ${baht(before.editPolicy.paidEditPrice)} → ${baht(after.editPolicy.paidEditPrice)}`)
  }

  const b0 = before.signupBonus
  const b1 = after.signupBonus
  if (b0.amount !== b1.amount) lines.push(`• โบนัสสมัครสมาชิก: ${baht(b0.amount)} → ${baht(b1.amount)}`)
  if (b0.startsAt !== b1.startsAt || b0.endsAt !== b1.endsAt) {
    lines.push(`• ช่วงเวลาโบนัส: ${when(b0.startsAt)} – ${when(b0.endsAt)} → ${when(b1.startsAt)} – ${when(b1.endsAt)}`)
  }
  return lines
}
