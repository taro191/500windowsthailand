import { useEffect, useState } from 'react'
import { MessageCircle, Save, Send } from 'lucide-react'
import { loadLineStatus, saveLineRecipients, sendLineTest, type LineStatus } from '@/lib/adminApi'
import type { AdminPageProps } from './adminData'
import { Badge, Button, Card, FormRow, inputClass, thaiDateTime } from './ui'

/** Super admin only: who gets new-slip alerts on LINE, with a test button. */
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
      title="แจ้งเตือนสลิปใหม่ทาง LINE"
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
