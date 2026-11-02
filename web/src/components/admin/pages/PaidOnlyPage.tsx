import { useState } from 'react'
import { Lock, Save } from 'lucide-react'
import { isPaidOnly, paidOnlyCount, parsePaidOnly } from '@shared/paidOnly'
import { updateSettings } from '@/lib/adminApi'
import { useSettings } from '@/lib/settings'
import type { AdminPageProps } from '../adminData'
import { Badge, Button, Callout, Card, FormRow, inputClass } from '../ui'

/** Window codes kept for paying owners: a free trial can't start on them (shared/paidOnly.ts). */
export function PaidOnlyPage({ data, notify }: AdminPageProps) {
  const settings = useSettings()
  const saved = settings.paidOnly.codes
  const [codes, setCodes] = useState(saved)
  const [busy, setBusy] = useState(false)
  const { error } = parsePaidOnly(codes)
  const changed = codes.trim().toUpperCase() !== saved

  // Trials already held on a reserved code keep running until they end (not taken back).
  const heldTrials = data.windows.filter((w) => w.trialEndsAt && isPaidOnly(w.code, saved))

  const save = async () => {
    setBusy(true)
    const result = await updateSettings({ ...settings, paidOnly: { codes } }, 'รหัสสงวนสำหรับผู้ใช้งานจริง')
    setBusy(false)
    if (!result.success) return notify(result.error, 'error')
    notify('บันทึกแล้ว')
  }

  return (
    <div className="max-w-4xl">
      <Callout tone="info">
        หมายเลขที่สงวนไว้ <b>ผู้ที่เลือกทดลองใช้ฟรีขอรับไม่ได้</b> ต้องจับจองแบบชำระเงินเท่านั้น · บนกระดานบานว่างที่สงวนไว้จะมีป้าย "สงวนสำหรับผู้ใช้งานจริง" · ผู้ที่ทดลองใช้บานนั้นอยู่ก่อนแล้ว
        ใช้ต่อได้จนครบช่วงทดลอง · ทุกการแก้ไขบันทึกในบันทึกการใช้งาน และแจ้งเตือน LINE (หัวข้อการตั้งค่า)
      </Callout>
      <Card title="รหัสสงวนสำหรับผู้ใช้งานจริง" icon={Lock} outline="primary">
        <FormRow
          label="รหัสหน้าต่าง"
          hint="คั่นด้วยจุลภาคหรือขึ้นบรรทัดใหม่ · รหัสเดี่ยว เช่น KAP-TH-008 หรือช่วง เช่น KAP-TH-088..099, KAP-NE-TH-001..050 (ช่วงต้องอยู่ในกลุ่มเดียวกัน)"
        >
          <textarea value={codes} onChange={(e) => setCodes(e.target.value)} rows={5} className={`${inputClass} font-mono`} placeholder="KAP-TH-008, KAP-TH-088..099" />
        </FormRow>
        <div className="flex items-center gap-3 flex-wrap">
          {error ? <span className="text-sm text-[#dc3545]">{error}</span> : <Badge tone="info">สงวนไว้ {paidOnlyCount(codes).toLocaleString()} บาน</Badge>}
          <Button className="ml-auto" disabled={busy || !changed || !!error} onClick={save}>
            <Save className="w-4 h-4" /> บันทึก
          </Button>
        </div>
      </Card>
      {heldTrials.length > 0 && (
        <Card title={`บานทดลองที่อยู่บนรหัสสงวน (${heldTrials.length})`} icon={Lock}>
          <p className="text-sm text-[#6c757d] mt-0">เริ่มทดลองก่อนรหัสถูกสงวน ใช้ต่อได้จนครบช่วงทดลอง</p>
          <ul className="text-sm m-0 pl-5">
            {heldTrials.map((w) => (
              <li key={w.code}>
                <span className="font-mono">{w.code}</span> · {w.ownerName}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
