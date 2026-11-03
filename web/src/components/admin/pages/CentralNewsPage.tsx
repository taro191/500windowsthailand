import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Newspaper, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import type { CentralNews } from '@shared/types'
import { deleteCentralNews, loadCentralNews, publishCentralNews, saveCentralNews, type CentralNewsInput } from '@/lib/adminApi'
import { compressImage } from '@/lib/browser'
import type { AdminPageProps } from '../adminData'
import { Badge, Button, Callout, Card, DataTable, FormRow, inputClass, Modal, thaiDateTime } from '../ui'

const TYPES: Record<CentralNews['type'], string> = { system: 'ระบบ', partner: 'พันธมิตร', product: 'สินค้าใหม่', news: 'ข่าวสาร' }

/** ISO time ↔ the value of a datetime-local input (the admin's own clock). */
const toLocalInput = (iso?: string) => (iso ? new Date(Date.parse(iso) - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '')
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : '')

const emptyInput = (): CentralNewsInput => ({ type: 'system', title: '', body: '', by: '', url: '', img: '', pin: false, publishAt: new Date().toISOString(), endAt: '' })

function liveNow(n: CentralNews) {
  const t = Date.now()
  return n.status === 'published' && Date.parse(n.publishAt) <= t && (!n.endAt || Date.parse(n.endAt) > t)
}

/** "500WinTH & Co" on the central page: drafts, publishing with a time window, at most 4 shown at once. */
export function CentralNewsPage({ admin, notify }: AdminPageProps) {
  const [news, setNews] = useState<CentralNews[] | null>(null)
  const [editing, setEditing] = useState<{ id?: string; input: CentralNewsInput } | null>(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    const result = await loadCentralNews()
    if (!result.success) return notify(result.error, 'error')
    setNews(result.news)
  }, [notify])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (key: string, action: () => ReturnType<typeof loadCentralNews>, done: string) => {
    setBusy(key)
    const result = await action()
    setBusy('')
    if (!result.success) {
      notify(result.error, 'error')
      return false
    }
    setNews(result.news)
    notify(done)
    return true
  }

  const save = async () => {
    if (!editing) return
    if (await run('save', () => saveCentralNews(editing.input, editing.id), 'บันทึกร่างแล้ว กดเผยแพร่เพื่อให้ขึ้นหน้าส่วนกลาง')) setEditing(null)
  }
  const pickImage = async (file: File | undefined) => {
    if (!file || !editing) return
    const img = await compressImage(file, 1200)
    setEditing({ ...editing, input: { ...editing.input, img } })
  }
  const set = (next: Partial<CentralNewsInput>) => editing && setEditing({ ...editing, input: { ...editing.input, ...next } })

  return (
    <div className="max-w-5xl">
      <Callout tone="info">
        ประกาศใน <b>500WinTH &amp; Co</b> ของ <a href="/kap/central.html" target="_blank" rel="noreferrer">หน้าส่วนกลาง</a> · บันทึกแล้วเป็น <b>ร่าง</b> จนกว่าจะกดเผยแพร่ · แก้ไขประกาศที่เผยแพร่แล้ว
        จะกลับเป็นร่างและต้องกดเผยแพร่ใหม่ · <b>ผู้เขียนหรือผู้แก้ไขล่าสุดเผยแพร่เองไม่ได้</b> ต้องให้ผู้ดูแลอีกคนตรวจ · ขึ้นพร้อมกันได้ไม่เกิน 4 รายการ (ระบบไม่ให้เผยแพร่ถ้าช่วงเวลาซ้อนกันเกิน 4) · ประกาศของพันธมิตรต้องตรวจเนื้อหาก่อนเผยแพร่ทุกครั้ง
      </Callout>
      <Card
        title="ประกาศ 500WinTH & Co"
        icon={Newspaper}
        outline="primary"
        tools={
          <Button size="sm" onClick={() => setEditing({ input: emptyInput() })}>
            <Plus className="w-4 h-4" /> เพิ่มประกาศ
          </Button>
        }
        flush
      >
        <DataTable head={['ประเภท', 'หัวข้อ', 'ช่วงเวลา', 'สถานะ', '']} empty={news ? 'ยังไม่มีประกาศ' : 'กำลังโหลด…'}>
          {(news ?? []).map((n) => (
            <tr key={n.id}>
              <td className="whitespace-nowrap">{TYPES[n.type]}</td>
              <td>
                <div className="font-bold">
                  {n.pin && '📌 '}
                  {n.title}
                </div>
                <div className="text-[0.8rem] text-[#6c757d]">
                  {n.by} · เขียนโดย {n.createdBy}
                  {n.publishedBy && ` · เผยแพร่โดย ${n.publishedBy}`}
                </div>
              </td>
              <td className="whitespace-nowrap text-[0.8rem]">
                {thaiDateTime(n.publishAt)}
                <br />– {n.endAt ? thaiDateTime(n.endAt) : 'ไม่กำหนด'}
              </td>
              <td className="whitespace-nowrap">
                {n.status === 'draft' ? <Badge tone="secondary">{n.authorId === admin.id ? 'ร่าง · รอผู้ดูแลอีกคนตรวจ' : 'ร่าง'}</Badge> : liveNow(n) ? <Badge tone="success">กำลังแสดง</Badge> : <Badge tone="info">เผยแพร่ (นอกช่วงเวลา)</Badge>}
              </td>
              <td className="whitespace-nowrap">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    tone={n.status === 'draft' ? 'success' : 'secondary'}
                    disabled={busy === n.id || (n.status === 'draft' && n.authorId === admin.id)}
                    title={n.status === 'draft' && n.authorId === admin.id ? 'ต้องให้ผู้ดูแลอีกคนตรวจและเผยแพร่' : undefined}
                    onClick={() => run(n.id, () => publishCentralNews(n.id, n.status === 'draft'), n.status === 'draft' ? 'เผยแพร่แล้ว' : 'หยุดเผยแพร่แล้ว')}
                  >
                    {n.status === 'draft' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} {n.status === 'draft' ? 'เผยแพร่' : 'หยุดเผยแพร่'}
                  </Button>
                  <Button
                    size="sm"
                    tone="secondary"
                    outline
                    onClick={() => setEditing({ id: n.id, input: { type: n.type, title: n.title, body: n.body, by: n.by, url: n.url, img: n.img, pin: n.pin, publishAt: n.publishAt, endAt: n.endAt ?? '' } })}
                  >
                    <Pencil className="w-3.5 h-3.5" /> แก้ไข
                  </Button>
                  <Button
                    size="sm"
                    tone="danger"
                    outline
                    disabled={busy === n.id}
                    onClick={() => window.confirm(`ลบประกาศ «${n.title}»?`) && run(n.id, () => deleteCentralNews(n.id), 'ลบประกาศแล้ว')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      {editing && (
        <Modal
          title={editing.id ? 'แก้ไขประกาศ' : 'เพิ่มประกาศ'}
          icon={Newspaper}
          onClose={() => setEditing(null)}
          footer={
            <Button disabled={busy === 'save'} onClick={save}>
              <Save className="w-4 h-4" /> บันทึกร่าง
            </Button>
          }
        >
          <FormRow label="ประเภท">
            <select value={editing.input.type} onChange={(e) => set({ type: e.target.value as CentralNews['type'] })} className={inputClass}>
              {Object.entries(TYPES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="หัวข้อ">
            <input value={editing.input.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} className={inputClass} />
          </FormRow>
          <FormRow label="รายละเอียด" hint="ไม่เกิน 400 ตัวอักษร">
            <textarea value={editing.input.body} maxLength={400} rows={3} onChange={(e) => set({ body: e.target.value })} className={inputClass} />
          </FormRow>
          <FormRow label="ผู้ประกาศ" hint="เว้นว่าง = 500 Windows Thailand">
            <input value={editing.input.by} maxLength={60} onChange={(e) => set({ by: e.target.value })} className={inputClass} />
          </FormRow>
          <FormRow label="ลิงก์" hint="https://… หรือ /… (หน้าในเว็บนี้) · เว้นว่างได้">
            <input value={editing.input.url} maxLength={500} onChange={(e) => set({ url: e.target.value })} className={inputClass} />
          </FormRow>
          <FormRow label="รูป (ไม่บังคับ)">
            <div className="flex items-center gap-2 flex-wrap">
              {editing.input.img && <img src={editing.input.img} alt="" className="h-14 rounded border border-[#dee2e6]" />}
              <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} className="text-sm" />
              {editing.input.img && (
                <Button size="sm" tone="secondary" outline onClick={() => set({ img: '' })}>
                  เอารูปออก
                </Button>
              )}
            </div>
          </FormRow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <FormRow label="เริ่มเผยแพร่">
              <input type="datetime-local" value={toLocalInput(editing.input.publishAt)} onChange={(e) => set({ publishAt: fromLocalInput(e.target.value) })} className={inputClass} />
            </FormRow>
            <FormRow label="สิ้นสุด" hint="เว้นว่าง = ไม่กำหนด">
              <input type="datetime-local" value={toLocalInput(editing.input.endAt)} onChange={(e) => set({ endAt: fromLocalInput(e.target.value) })} className={inputClass} />
            </FormRow>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.input.pin} onChange={(e) => set({ pin: e.target.checked })} /> ปักหมุด (แสดงก่อนรายการอื่น)
          </label>
        </Modal>
      )}
    </div>
  )
}
