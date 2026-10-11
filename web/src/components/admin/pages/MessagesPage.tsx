import { useState } from 'react'
import { Check, Inbox, Mail, Phone, RotateCcw } from 'lucide-react'
import type { ContactMessageEntry } from '@shared/types'
import { updateContactMessage } from '@/lib/adminApi'
import type { AdminPageProps } from '../adminData'
import { Badge, Button, Card, thaiDateTime } from '../ui'

type Filter = ContactMessageEntry['status'] | 'all'
const FILTER_LABELS: Record<Filter, string> = { new: 'ยังไม่จัดการ', done: 'จัดการแล้ว', all: 'ทั้งหมด' }

/** Messages from the "contact us" form; any admin can mark one done with a note for the others. */
export function MessagesPage({ data, refresh, notify }: AdminPageProps) {
  const [filter, setFilter] = useState<Filter>('new')
  const [busyId, setBusyId] = useState<string | null>(null)
  const messages = data.contactMessages.filter((m) => filter === 'all' || m.status === filter)
  const count = (f: Filter) => data.contactMessages.filter((m) => f === 'all' || m.status === f).length

  const mark = async (m: ContactMessageEntry, status: ContactMessageEntry['status']) => {
    let note = m.adminNote
    if (status === 'done') {
      const input = window.prompt(`บันทึกการจัดการข้อความของ ${m.name} (ไม่บังคับ):`, m.adminNote || 'ติดต่อกลับแล้ว')
      if (input === null) return
      note = input.trim()
    }
    setBusyId(m.id)
    const result = await updateContactMessage(m.id, status, note)
    setBusyId(null)
    if (!result.success) return notify(result.error, 'error')
    await refresh()
    notify(status === 'done' ? `จัดการข้อความของ ${m.name} แล้ว` : `เปิดข้อความของ ${m.name} อีกครั้ง`)
  }

  return (
    <Card
      title="ข้อความจากฟอร์มติดต่อเรา"
      icon={Inbox}
      outline="primary"
      tools={
        <div className="flex gap-1">
          {(['new', 'done', 'all'] as const).map((f) => (
            <Button key={f} size="sm" tone="secondary" outline={filter !== f} onClick={() => setFilter(f)}>
              {FILTER_LABELS[f]} ({count(f)})
            </Button>
          ))}
        </div>
      }
    >
      {messages.length === 0 ? (
        <p className="text-sm text-[#6c757d] m-0">ไม่มีข้อความในสถานะนี้</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`p-3 rounded border text-sm ${m.status === 'new' ? 'border-[#ffc107] bg-[#fff8e1]' : 'border-[#dee2e6]'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-bold">
                    {m.name} <Badge tone="info">{m.subject}</Badge>{' '}
                    {m.status === 'new' ? <Badge tone="warning">ยังไม่จัดการ</Badge> : <Badge tone="success">จัดการแล้ว</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-[#6c757d] text-[0.8rem]">
                    <span>{thaiDateTime(m.createdAt)}</span>
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-[#007bff]">
                        <Mail className="w-3 h-3" /> {m.email}
                      </a>
                    )}
                    {m.phone && (
                      <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-[#007bff]">
                        <Phone className="w-3 h-3" /> {m.phone}
                      </a>
                    )}
                    <span>{m.userName ? `บัญชี: ${m.userName}` : 'ไม่ได้เข้าสู่ระบบ'}</span>
                  </div>
                </div>
                {m.status === 'new' ? (
                  <Button size="sm" tone="success" disabled={busyId === m.id} onClick={() => mark(m, 'done')}>
                    <Check className="w-3.5 h-3.5" /> จัดการแล้ว
                  </Button>
                ) : (
                  <Button size="sm" tone="secondary" outline disabled={busyId === m.id} onClick={() => mark(m, 'new')}>
                    <RotateCcw className="w-3.5 h-3.5" /> เปิดอีกครั้ง
                  </Button>
                )}
              </div>
              <p className="mt-2 mb-0 whitespace-pre-line break-words">{m.message}</p>
              {m.status === 'done' && (
                <p className="mt-2 mb-0 text-[0.8rem] text-[#6c757d]">
                  ✔ {m.handledBy} · {thaiDateTime(m.handledAt ?? undefined)}
                  {m.adminNote && ` · ${m.adminNote}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
