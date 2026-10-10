import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { loadLineStatus, sendLineTest, type LineStatus } from '@/lib/adminApi'
import type { AdminPageProps } from './adminData'
import { Badge, Button, Card, thaiDateTime } from './ui'

/** Super admin only: whether new slips are sent to the finance admin's LINE, with a test button. */
export function LineAlertCard({ notify }: Pick<AdminPageProps, 'notify'>) {
  const [status, setStatus] = useState<LineStatus | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadLineStatus().then((r) => r.success && setStatus(r))
  }, [])

  const test = async () => {
    setSending(true)
    const result = await sendLineTest()
    setSending(false)
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
          <Button size="sm" tone="success" onClick={test} disabled={sending}>
            <Send className="w-3.5 h-3.5" /> {sending ? 'กำลังส่ง...' : 'ส่งข้อความทดสอบ'}
          </Button>
        )
      }
    >
      <div className="text-sm space-y-1.5">
        <div>
          {status.configured ? (
            <Badge tone="success">เปิดใช้งาน · ส่งถึง {status.recipients} ปลายทาง</Badge>
          ) : (
            <Badge tone="secondary">ยังไม่ได้ตั้งค่า</Badge>
          )}
        </div>
        {!status.configured && (
          <p className="text-[#6c757d]">
            ตั้งค่า env <code>LINE_CHANNEL_ACCESS_TOKEN</code>, <code>LINE_CHANNEL_SECRET</code> และ <code>LINE_ADMIN_TO</code> ใน Plesk
            ({status.hasToken ? 'มี token แล้ว' : 'ยังไม่มี token'} · {status.recipients ? `มีผู้รับ ${status.recipients} ราย` : 'ยังไม่มีผู้รับ'}) แล้วกด Restart App
          </p>
        )}
        {status.lastFailure && (
          <p className="text-[#dc3545]">
            ส่งไม่สำเร็จล่าสุด {thaiDateTime(status.lastFailure.at)}: {status.lastFailure.error}
          </p>
        )}
      </div>
    </Card>
  )
}
