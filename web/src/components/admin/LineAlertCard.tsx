import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Save, Send } from 'lucide-react'
import { LINE_ALERT_GROUPS, LINE_ALERT_TOPICS, type LineAlertTopic, type LineAlertTopics } from '@shared/lineAlerts'
import { loadLineStatus, saveLineRecipients, saveLineTopics, sendLineTest, type LineStatus } from '@/lib/adminApi'
import type { AdminPageProps } from './adminData'
import { Badge, Button, Card, FormRow, inputClass, thaiDateTime } from './ui'

/** A checkbox that also shows "some on" (indeterminate) for a whole group. */
function GroupCheckbox({ on, some, onChange }: { on: boolean; some: boolean; onChange: (on: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some && !on
  }, [on, some])
  return <input ref={ref} type="checkbox" className="mt-1" checked={on} onChange={(e) => onChange(e.target.checked)} />
}

/** Super admin only: who gets LINE alerts and which kinds (each topic of each group), with a test button. */
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

  /** Saves the switches at once; label names what changed for the toast. */
  const toggle = async (ids: LineAlertTopic[], on: boolean, label: string) => {
    const result = await saveLineTopics(Object.fromEntries(ids.map((id) => [id, on])) as Partial<LineAlertTopics>)
    if (!result.success) return notify(result.error || 'บันทึกไม่สำเร็จ', 'error')
    setStatus(result) // keeps any IDs being typed
    notify(`${on ? 'เปิด' : 'ปิด'}แจ้งเตือน "${label}" แล้ว`)
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
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {LINE_ALERT_GROUPS.map((g) => {
              const topics = LINE_ALERT_TOPICS.filter((t) => t.group === g.id)
              const onCount = topics.filter((t) => status.topics[t.id]).length
              return (
                <div key={g.id} className={`p-2 rounded border ${onCount ? 'border-[#28a745] bg-[#28a745]/5' : 'border-[#dee2e6] bg-[#f8f9fa]'}`}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <GroupCheckbox
                      on={onCount === topics.length}
                      some={onCount > 0}
                      onChange={(on) => toggle(topics.map((t) => t.id), on, g.label)}
                    />
                    <span>
                      <span className="font-bold">{g.label}</span>{' '}
                      <span className="text-[0.75rem] text-[#6c757d]">
                        ({onCount}/{topics.length}) · {g.hint}
                      </span>
                    </span>
                  </label>
                  <div className="mt-1 ml-6 space-y-0.5">
                    {topics.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer text-[0.85rem]">
                        <input type="checkbox" checked={status.topics[t.id]} onChange={(e) => toggle([t.id], e.target.checked, t.label)} />
                        {t.label}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
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
