import { useEffect, useState } from 'react'
import { MessageCircle, Save, Send } from 'lucide-react'
import { loadLineStatus, saveLineGroups, saveLineRecipients, sendLineTest, type LineAlertGroup, type LineStatus } from '@/lib/adminApi'
import type { AdminPageProps } from './adminData'
import { Badge, Button, Card, FormRow, inputClass, thaiDateTime } from './ui'

const GROUPS: { id: LineAlertGroup; label: string; hint: string }[] = [
  { id: 'slips', label: 'สลิปรอตรวจ', hint: 'ทันทีที่ลูกค้าส่งสลิป (เติมเงิน / จับจอง / ซื้อต่อ / โปรโมท)' },
  { id: 'finance', label: 'ความเคลื่อนไหวทางการเงิน', hint: 'เงินเข้า-ออกทุกรายการ สรุปทุก 30 วินาที' },
  { id: 'settings', label: 'การแก้ไขการตั้งค่า', hint: 'กติกา, ช่องทางชำระเงิน, เพดานราคา ฯลฯ พร้อมค่าก่อน-หลัง' },
]

/** Super admin only: who gets LINE alerts and which kinds (slips, money movements, settings changes), with a test button. */
export function LineAlertCard({ notify }: Pick<AdminPageProps, 'notify'>) {
  const [status, setStatus] = useState<LineStatus | null>(null)
  const [ids, setIds] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)

  const show = (next: LineStatus) => {
    setStatus(next)
    setIds(next.saved.join('\n'))
  }

  useEffect(() => {
    loadLineStatus().then((r) => r.success && show(r))
  }, [])

  const save = async () => {
    setBusy('save')
    const result = await saveLineRecipients(ids.split(/[\s,]+/).filter(Boolean))
    setBusy(null)
    if (!result.success) return notify(result.error || 'บันทึกไม่สำเร็จ', 'error')
    show(result)
    notify('บันทึกผู้รับแจ้งเตือน LINE แล้ว')
  }

  const toggle = async (group: LineAlertGroup, on: boolean) => {
    const result = await saveLineGroups({ [group]: on })
    if (!result.success) return notify(result.error || 'บันทึกไม่สำเร็จ', 'error')
    setStatus(result) // keeps any IDs being typed
    notify(`${on ? 'เปิด' : 'ปิด'}แจ้งเตือน "${GROUPS.find((g) => g.id === group)?.label}" แล้ว`)
  }

  const test = async () => {
    setBusy('test')
    const result = await sendLineTest()
    setBusy(null)
    if (!result.success) return notify(result.error || 'ส่ง LINE ไม่สำเร็จ', 'error')
    notify(`ส่งข้อความทดสอบไป LINE แล้ว (${result.sent} ปลายทาง)`)
  }

  if (!status) return null
  return (
    <Card
      title="แจ้งเตือนทาง LINE"
      icon={MessageCircle}
      outline={status.configured ? 'success' : 'secondary'}
      tools={
        status.configured && (
          <Button size="sm" tone="success" onClick={test} disabled={!!busy}>
            <Send className="w-3.5 h-3.5" /> {busy === 'test' ? 'กำลังส่ง...' : 'ส่งข้อความทดสอบ'}
          </Button>
        )
      }
    >
      <div className="text-sm space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {status.configured ? (
            <Badge tone="success">เปิดใช้งาน · ส่งถึง {status.recipients} ปลายทาง</Badge>
          ) : (
            <Badge tone="secondary">ยังไม่พร้อมใช้งาน</Badge>
          )}
          <Badge tone={status.hasToken ? 'success' : 'danger'}>{status.hasToken ? 'มี Access token' : 'ไม่มี Access token'}</Badge>
          <Badge tone={status.hasSecret ? 'success' : 'warning'}>{status.hasSecret ? 'มี Channel secret' : 'ไม่มี Channel secret'}</Badge>
          {status.fromEnv > 0 && <Badge tone="info">จาก LINE_ADMIN_TO {status.fromEnv} ราย</Badge>}
        </div>
        <div>
          <div className="font-bold mb-1">ข้อความที่ส่งทาง LINE</div>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {GROUPS.map((g) => (
              <label
                key={g.id}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${status.groups[g.id] ? 'border-[#28a745] bg-[#28a745]/5' : 'border-[#dee2e6] bg-[#f8f9fa]'}`}
              >
                <input type="checkbox" className="mt-1" checked={status.groups[g.id]} onChange={(e) => toggle(g.id, e.target.checked)} />
                <span>
                  <span className="font-bold block">{g.label}</span>
                  <span className="text-[0.8rem] text-[#6c757d]">{g.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <FormRow label="LINE ID ผู้รับแจ้งเตือน" hint="ให้แอดมินการเงินพิมพ์ id ในแชทกับ LINE OA แล้วนำ ID ที่บอทตอบมาใส่ (หลายคนขึ้นบรรทัดใหม่)">
          <textarea
            value={ids}
            onChange={(e) => setIds(e.target.value)}
            rows={2}
            placeholder="U1234567890abcdef1234567890abcdef"
            className={`${inputClass} font-mono`}
          />
        </FormRow>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={!!busy}>
            <Save className="w-3.5 h-3.5" /> {busy === 'save' ? 'กำลังบันทึก...' : 'บันทึกผู้รับ'}
          </Button>
        </div>
        {status.lastFailure && (
          <p className="text-[#dc3545]">
            ส่งไม่สำเร็จล่าสุด {thaiDateTime(status.lastFailure.at)}: {status.lastFailure.error}
          </p>
        )}
      </div>
    </Card>
  )
}
