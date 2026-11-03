import { useState } from 'react'
import { Ban, Lock, Save, type LucideIcon } from 'lucide-react'
import type { PlatformSettings } from '@shared/types'
import { inCodeList, paidOnlyCount, parsePaidOnly } from '@shared/paidOnly'
import { updateSettings } from '@/lib/adminApi'
import { useSettings } from '@/lib/settings'
import type { AdminPageProps } from '../adminData'
import { Badge, Button, Callout, Card, FormRow, inputClass } from '../ui'

const CODES_HINT = 'คั่นด้วยจุลภาคหรือขึ้นบรรทัดใหม่ · รหัสเดี่ยว เช่น KAP-TH-008 หรือช่วง เช่น KAP-TH-088..099, KAP-NE-TH-001..050 (ช่วงต้องอยู่ในกลุ่มเดียวกัน)'

/**
 * Window code lists kept in settings (shared/paidOnly.ts format):
 * paid-only codes refuse a free trial, not-for-sale codes refuse any claim.
 */
export function PaidOnlyPage({ data, notify }: AdminPageProps) {
  const settings = useSettings()

  // Windows already held on a listed code keep their owner (nothing is taken back).
  const heldTrials = data.windows.filter((w) => w.trialEndsAt && inCodeList(w.code, settings.paidOnly.codes))
  const heldNotForSale = data.windows.filter((w) => w.ownerId && inCodeList(w.code, settings.notForSale.codes))

  return (
    <div className="max-w-4xl">
      <Callout tone="info">
        <b>บานไม่เปิดขาย</b> จับจองไม่ได้ทั้งแบบชำระเงินและทดลองใช้ฟรี · <b>รหัสสงวนสำหรับผู้ใช้งานจริง</b> ผู้ที่เลือกทดลองใช้ฟรีขอรับไม่ได้
        ต้องจับจองแบบชำระเงินเท่านั้น · บานที่มีผู้ถือครองอยู่ก่อนแล้วไม่ถูกเรียกคืน · ทุกการแก้ไขบันทึกในบันทึกการใช้งาน และแจ้งเตือน LINE (หัวข้อการตั้งค่า)
      </Callout>
      <CodeListCard
        title="บานไม่เปิดขาย"
        icon={Ban}
        outline="danger"
        field="notForSale"
        countLabel="ไม่เปิดขาย"
        what="บานไม่เปิดขาย"
        notify={notify}
      />
      {heldNotForSale.length > 0 && (
        <HeldList title={`บานไม่เปิดขายที่มีผู้ถือครองอยู่ (${heldNotForSale.length})`} hint="ถือครองก่อนถูกตั้งเป็นบานไม่เปิดขาย ยังเป็นของผู้ถือครองเดิม" windows={heldNotForSale} />
      )}
      <CodeListCard
        title="รหัสสงวนสำหรับผู้ใช้งานจริง"
        icon={Lock}
        outline="primary"
        field="paidOnly"
        countLabel="สงวนไว้"
        what="รหัสสงวนสำหรับผู้ใช้งานจริง"
        notify={notify}
      />
      {heldTrials.length > 0 && (
        <HeldList title={`บานทดลองที่อยู่บนรหัสสงวน (${heldTrials.length})`} hint="เริ่มทดลองก่อนรหัสถูกสงวน ใช้ต่อได้จนครบช่วงทดลอง" windows={heldTrials} />
      )}
    </div>
  )
}

function CodeListCard({
  title,
  icon,
  outline,
  field,
  countLabel,
  what,
  notify,
}: {
  title: string
  icon: LucideIcon
  outline: 'primary' | 'danger'
  field: keyof Pick<PlatformSettings, 'paidOnly' | 'notForSale'>
  countLabel: string
  what: string
  notify: AdminPageProps['notify']
}) {
  const settings = useSettings()
  const saved = settings[field].codes
  const [codes, setCodes] = useState(saved)
  const [busy, setBusy] = useState(false)
  const { error } = parsePaidOnly(codes)
  const changed = codes.trim().toUpperCase() !== saved

  const save = async () => {
    setBusy(true)
    const result = await updateSettings({ ...settings, [field]: { codes } }, what)
    setBusy(false)
    if (!result.success) return notify(result.error, 'error')
    notify('บันทึกแล้ว')
  }

  return (
    <Card title={title} icon={icon} outline={outline}>
      <FormRow label="รหัสหน้าต่าง" hint={CODES_HINT}>
        <textarea value={codes} onChange={(e) => setCodes(e.target.value)} rows={4} className={`${inputClass} font-mono`} placeholder="KAP-TH-008, KAP-TH-088..099" />
      </FormRow>
      <div className="flex items-center gap-3 flex-wrap">
        {error ? <span className="text-sm text-[#dc3545]">{error}</span> : <Badge tone="info">{countLabel} {paidOnlyCount(codes).toLocaleString()} บาน</Badge>}
        <Button className="ml-auto" disabled={busy || !changed || !!error} onClick={save}>
          <Save className="w-4 h-4" /> บันทึก
        </Button>
      </div>
    </Card>
  )
}

function HeldList({ title, hint, windows }: { title: string; hint: string; windows: AdminPageProps['data']['windows'] }) {
  return (
    <Card title={title} icon={Lock}>
      <p className="text-sm text-[#6c757d] mt-0">{hint}</p>
      <ul className="text-sm m-0 pl-5">
        {windows.map((w) => (
          <li key={w.code}>
            <span className="font-mono">{w.code}</span> · {w.ownerName}
          </li>
        ))}
      </ul>
    </Card>
  )
}
