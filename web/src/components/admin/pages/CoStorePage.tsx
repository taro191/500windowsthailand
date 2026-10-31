import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Puzzle, Save, Trash2 } from 'lucide-react'
import type { CoStoreApp, PlatformSettings } from '@shared/types'
import { CO_STORE_LIMITS, isCoStoreUrl } from '@shared/settings'
import { updateSettings } from '@/lib/adminApi'
import { useSettings } from '@/lib/settings'
import type { AdminPageProps } from '../adminData'
import { Badge, Button, Callout, Card, DataTable, FormRow, inputClass, Modal } from '../ui'

const L = CO_STORE_LIMITS
const emptyApp = (): CoStoreApp => ({ id: `app-${Date.now().toString(36)}`, name: '', description: '', url: 'https://', icon: '🧩', iconUrl: '', category: '', badge: '' })

/** Web apps in the "Co Store" tab of every window page's "Kapsulep & Co" card. */
export function CoStorePage({ notify }: AdminPageProps) {
  const settings = useSettings()
  const { coStore } = settings
  const [title, setTitle] = useState(coStore.title)
  const [editing, setEditing] = useState<CoStoreApp | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (next: PlatformSettings['coStore'], what: string) => {
    setBusy(true)
    const result = await updateSettings({ ...settings, coStore: next }, `Kapsulep & Co → ${what}`)
    setBusy(false)
    if (!result.success) {
      notify(result.error, 'error')
      return false
    }
    notify('บันทึกแล้ว')
    return true
  }
  const setApps = (apps: CoStoreApp[], what: string) => save({ ...coStore, apps }, what)
  const move = (index: number, by: number) => {
    const apps = [...coStore.apps]
    const [app] = apps.splice(index, 1)
    apps.splice(index + by, 0, app)
    return setApps(apps, `เลื่อน ${app.name}`)
  }

  return (
    <div className="max-w-5xl">
      <Callout tone="info">
        แสดงในการ์ด <b>Kapsulep &amp; Co</b> ของทุกหน้าต่าง (แท็บ Co Store) คู่กับแท็บ Co Center ที่ระบบสุ่มหน้าต่างแนะนำทุก 2 ชั่วโมงเอง · ไม่มีเว็บแอปเลย = แสดงเฉพาะ Co Center · ลิงก์{' '}
        <code>https://</code> เปิดแท็บใหม่ ลิงก์ <code>/…</code> เปิดหน้าในเว็บนี้ · เพิ่มได้สูงสุด {L.apps} รายการ
      </Callout>
      <Card title="ชื่อการ์ด" icon={Puzzle} outline="primary">
        <form
          className="flex gap-2 items-end flex-wrap"
          onSubmit={(e) => {
            e.preventDefault()
            if (title.trim() !== coStore.title) save({ ...coStore, title: title.trim() }, `ชื่อการ์ด ${title.trim()}`)
          }}
        >
          <div className="flex-1 min-w-[220px]">
            <FormRow label="ชื่อที่แสดงบนหัวการ์ด" hint="เว้นว่าง = Kapsulep & Co">
              <input value={title} maxLength={L.title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </FormRow>
          </div>
          <Button type="submit" disabled={busy || title.trim() === coStore.title} className="mb-3">
            <Save className="w-4 h-4" /> บันทึก
          </Button>
        </form>
      </Card>
      <Card
        title={`เว็บแอปใน Co Store (${coStore.apps.length}/${L.apps})`}
        icon={Puzzle}
        outline="primary"
        flush
        tools={
          <Button size="sm" disabled={busy || coStore.apps.length >= L.apps} onClick={() => setEditing(emptyApp())}>
            <Plus className="w-3.5 h-3.5" /> เพิ่มเว็บแอป
          </Button>
        }
      >
        <DataTable head={['ลำดับ', 'เว็บแอป', 'หมวด', 'ลิงก์', 'จัดการ']} empty="ยังไม่มีเว็บแอป">
          {coStore.apps.map((app, i) => (
            <tr key={app.id}>
              <td className="whitespace-nowrap">
                <div className="flex gap-1">
                  <Button size="sm" tone="secondary" outline disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="เลื่อนขึ้น">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" tone="secondary" outline disabled={busy || i === coStore.apps.length - 1} onClick={() => move(i, 1)} aria-label="เลื่อนลง">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </td>
              <td>
                <div className="flex gap-2 items-center">
                  <span className="w-8 h-8 shrink-0 rounded grid place-items-center bg-[#f4f6f9] text-lg overflow-hidden">
                    {app.iconUrl ? <img src={app.iconUrl} alt="" className="w-full h-full object-cover" /> : app.icon || '🧩'}
                  </span>
                  <div className="min-w-0">
                    <b>{app.name}</b> {app.badge && <Badge tone="info">{app.badge}</Badge>}
                    {app.description && <div className="text-[#6c757d] text-[0.8rem] max-w-[320px] truncate">{app.description}</div>}
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap">{app.category || '-'}</td>
              <td className="max-w-[220px] truncate font-mono text-[0.8rem]" title={app.url}>
                {app.url}
              </td>
              <td className="whitespace-nowrap">
                <div className="flex gap-1">
                  <Button size="sm" tone="info" onClick={() => setEditing(app)}>
                    <Pencil className="w-3.5 h-3.5" /> แก้ไข
                  </Button>
                  <Button
                    size="sm"
                    tone="danger"
                    disabled={busy}
                    onClick={() => window.confirm(`ลบ "${app.name}" ออกจาก Co Store?`) && setApps(coStore.apps.filter((a) => a.id !== app.id), `ลบ ${app.name}`)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> ลบ
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
      {editing && (
        <AppForm
          app={editing}
          isNew={!coStore.apps.some((a) => a.id === editing.id)}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (app) => {
            const exists = coStore.apps.some((a) => a.id === app.id)
            const apps = exists ? coStore.apps.map((a) => (a.id === app.id ? app : a)) : [...coStore.apps, app]
            if (await setApps(apps, `${exists ? 'แก้ไข' : 'เพิ่ม'} ${app.name}`)) setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function AppForm({ app, isNew, busy, onClose, onSave }: { app: CoStoreApp; isNew: boolean; busy: boolean; onClose: () => void; onSave: (app: CoStoreApp) => void }) {
  const [form, setForm] = useState(app)
  const [error, setError] = useState('')
  const set = (patch: Partial<CoStoreApp>) => setForm({ ...form, ...patch })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as unknown as CoStoreApp
    if (!next.name) return setError('กรุณาระบุชื่อเว็บแอป')
    if (!isCoStoreUrl(next.url)) return setError('ลิงก์ต้องขึ้นต้นด้วย https:// หรือ / (หน้าในเว็บนี้)')
    if (next.iconUrl && !isCoStoreUrl(next.iconUrl)) return setError('รูปไอคอนต้องขึ้นต้นด้วย https:// หรือ /')
    onSave(next)
  }
  return (
    <Modal
      title={isNew ? 'เพิ่มเว็บแอป' : `แก้ไข: ${app.name}`}
      icon={Puzzle}
      onClose={onClose}
      footer={
        <>
          <Button tone="secondary" outline onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" form="co-app-form" disabled={busy}>
            <Save className="w-4 h-4" /> {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </>
      }
    >
      <form id="co-app-form" onSubmit={submit}>
        {error && <div className="mb-3 p-2.5 rounded bg-[#f8d7da] text-[#721c24] text-sm border border-[#f5c6cb]">{error}</div>}
        <div className="grid sm:grid-cols-[1fr_120px] gap-x-3">
          <FormRow label="ชื่อเว็บแอป">
            <input value={form.name} maxLength={L.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} autoFocus />
          </FormRow>
          <FormRow label="ไอคอน (อีโมจิ)">
            <input value={form.icon} onChange={(e) => set({ icon: [...e.target.value].slice(0, L.icon).join('') })} className={inputClass} />
          </FormRow>
        </div>
        <FormRow label="คำอธิบายสั้น">
          <input value={form.description} maxLength={L.description} onChange={(e) => set({ description: e.target.value })} className={inputClass} />
        </FormRow>
        <FormRow label="ลิงก์" hint="https://… เปิดแท็บใหม่ · /… เปิดหน้าในเว็บนี้">
          <input value={form.url} maxLength={L.url} onChange={(e) => set({ url: e.target.value })} className={`${inputClass} font-mono`} />
        </FormRow>
        <FormRow label="รูปไอคอน (ไม่บังคับ)" hint="URL รูปจัตุรัส ถ้าไม่ใส่จะใช้อีโมจิ">
          <input value={form.iconUrl} maxLength={L.url} onChange={(e) => set({ iconUrl: e.target.value })} placeholder="https://" className={`${inputClass} font-mono`} />
        </FormRow>
        <div className="grid sm:grid-cols-2 gap-x-3">
          <FormRow label="หมวด (ไม่บังคับ)" hint="มี 2 หมวดขึ้นไปจะมีปุ่มกรองหมวด">
            <input value={form.category} maxLength={L.category} onChange={(e) => set({ category: e.target.value })} className={inputClass} />
          </FormRow>
          <FormRow label="ป้าย (ไม่บังคับ)" hint="เช่น ใหม่ / ฟรี">
            <input value={form.badge} maxLength={L.badge} onChange={(e) => set({ badge: e.target.value })} className={inputClass} />
          </FormRow>
        </div>
      </form>
    </Modal>
  )
}
