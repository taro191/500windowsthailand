import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import type { WindowItem, WindowOffering, WindowProfile } from '@shared/types'
import { cleanProfile, emptyProfile, PROFILE_LIMITS, SOCIALS } from '@shared/windowProfile'
import { compressImage } from '@/lib/browser'
import { saveWindowProfile } from '@/lib/store'

interface EditProfileModalProps {
  windowItem: WindowItem
  onClose: () => void
  onSaved: (window: WindowItem) => void
}

const MAX_PICK_BYTES = 20 * 1024 * 1024
const L = PROFILE_LIMITS

const field =
  'w-full bg-stone-950 border border-stone-700 text-stone-100 rounded-lg focus:outline-none focus:border-rose-400 text-xs px-3 py-2 placeholder:text-stone-600'

/** Owner editor for the window's public page. Saving is free and doesn't use the daily edits. */
export function EditProfileModal({ windowItem, onClose, onSaved }: EditProfileModalProps) {
  const [profile, setProfile] = useState<WindowProfile>(() => ({ ...emptyProfile(), ...windowItem.profile }))
  const [highlights, setHighlights] = useState(() => (windowItem.profile?.highlights ?? []).join('\n'))
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof WindowProfile>(key: K, value: WindowProfile[K]) => setProfile((p) => ({ ...p, [key]: value }))

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '').slice(0, L.tagLength)
    setTagInput('')
    if (!tag || profile.tags.includes(tag) || profile.tags.length >= L.tags) return
    set('tags', [...profile.tags, tag])
  }

  const setOffering = (index: number, change: Partial<WindowOffering>) =>
    set('offerings', profile.offerings.map((o, i) => (i === index ? { ...o, ...change } : o)))
  const moveOffering = (index: number, step: number) => {
    const list = [...profile.offerings]
    const [item] = list.splice(index, 1)
    list.splice(index + step, 0, item)
    set('offerings', list)
  }

  const submit = async () => {
    const draft = { ...profile, highlights: highlights.split('\n') }
    if (tagInput.trim()) draft.tags = [...draft.tags, tagInput.trim()]
    const checked = cleanProfile(draft)
    if (checked.error) return setError(checked.error)
    setError('')
    setBusy(true)
    const result = await saveWindowProfile(windowItem.region, windowItem.id, checked.profile)
    setBusy(false)
    if (!result.success) return setError(result.error || 'บันทึกไม่สำเร็จ')
    onSaved(result.window)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto font-['Prompt',sans-serif]">
      <div className="relative w-full max-w-2xl bg-[#110e1a] border border-purple-900/50 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#09080e] border-b border-purple-900/30">
          <div>
            <h2 className="font-bold text-stone-100 text-base">แก้ไขโปรไฟล์บาน {windowItem.code}</h2>
            <p className="text-[11px] text-stone-400">ข้อมูลที่ผู้เยี่ยมชมเห็นในหน้ารายละเอียด · แก้ไขได้ฟรีไม่จำกัด · ไม่กรอกช่องไหน ช่องนั้นจะไม่แสดง</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg cursor-pointer" aria-label="ปิด">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6 text-xs">
          <Section title="โลโก้และแท็ก">
            <div className="flex gap-4 items-start">
              <ImageSlot
                value={profile.logoUrl}
                onChange={(url) => set('logoUrl', url)}
                onError={setError}
                size={300}
                square
                className="w-20 h-20 rounded-full"
                label="โลโก้"
              />
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {profile.tags.map((tag) => (
                    <span key={tag} className="pl-2.5 pr-1 py-0.5 rounded-full border border-purple-500/50 text-purple-200 flex items-center gap-1">
                      {tag}
                      <button type="button" onClick={() => set('tags', profile.tags.filter((t) => t !== tag))} className="p-0.5 hover:text-rose-300 cursor-pointer" aria-label={`ลบแท็ก ${tag}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                {profile.tags.length < L.tags && (
                  <div className="flex gap-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                      maxLength={L.tagLength}
                      placeholder="เช่น สินค้าเกษตร, ของฝาก (กด Enter)"
                      className={field}
                    />
                    <button type="button" onClick={addTag} className="px-3 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 cursor-pointer shrink-0">
                      เพิ่ม
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-stone-500">แท็กได้ไม่เกิน {L.tags} คำ</p>
              </div>
            </div>
          </Section>

          <Section title={`รูปเพิ่มเติม (${profile.gallery.length}/${L.gallery})`} hint="แสดงต่อจากรูปหลักของบาน เลื่อนดูได้">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {profile.gallery.map((url, i) => (
                <ImageSlot
                  key={`${i}-${url.slice(-24)}`}
                  value={url}
                  onChange={(next) => set('gallery', next ? profile.gallery.map((g, j) => (j === i ? next : g)) : profile.gallery.filter((_, j) => j !== i))}
                  onError={setError}
                  size={1200}
                  className="aspect-[4/3] w-full rounded-lg"
                />
              ))}
              {profile.gallery.length < L.gallery && (
                <ImageSlot value="" onChange={(url) => url && set('gallery', [...profile.gallery, url])} onError={setError} size={1200} className="aspect-[4/3] w-full rounded-lg" label="เพิ่มรูป" />
              )}
            </div>
          </Section>

          <Section title={`สิ่งที่นำเสนอ — สินค้าและบริการ (${profile.offerings.length}/${L.offerings})`}>
            <div className="space-y-2">
              {profile.offerings.map((o, i) => (
                <div key={i} className="flex gap-2 items-center p-2 rounded-lg bg-stone-950/60 border border-stone-800">
                  <ImageSlot value={o.imageUrl} onChange={(url) => setOffering(i, { imageUrl: url })} onError={setError} size={600} square className="w-14 h-14 rounded-lg" />
                  <div className="flex-1 grid sm:grid-cols-2 gap-2">
                    <input value={o.name} onChange={(e) => setOffering(i, { name: e.target.value })} maxLength={L.offeringName} placeholder="ชื่อ เช่น น้ำผึ้งแท้ 100%" className={field} />
                    <input value={o.note} onChange={(e) => setOffering(i, { note: e.target.value })} maxLength={L.offeringNote} placeholder="คำอธิบายสั้นๆ" className={field} />
                  </div>
                  <div className="flex flex-col">
                    <button type="button" disabled={i === 0} onClick={() => moveOffering(i, -1)} className="p-1 text-stone-400 hover:text-stone-100 disabled:opacity-30 cursor-pointer" aria-label="เลื่อนขึ้น">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" disabled={i === profile.offerings.length - 1} onClick={() => moveOffering(i, 1)} className="p-1 text-stone-400 hover:text-stone-100 disabled:opacity-30 cursor-pointer" aria-label="เลื่อนลง">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button type="button" onClick={() => set('offerings', profile.offerings.filter((_, j) => j !== i))} className="p-1.5 text-stone-500 hover:text-rose-400 cursor-pointer" aria-label="ลบรายการ">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {profile.offerings.length < L.offerings && (
                <button
                  type="button"
                  onClick={() => set('offerings', [...profile.offerings, { imageUrl: '', name: '', note: '' }])}
                  className="w-full py-2 rounded-lg border border-dashed border-purple-700/60 text-purple-300 hover:bg-purple-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มสินค้า / บริการ
                </button>
              )}
            </div>
          </Section>

          <Section title="ช่องทางติดต่อ" hint="แสดงต่อสาธารณะ กรอกเฉพาะช่องทางที่ต้องการให้ผู้คนติดต่อ">
            <div className="grid sm:grid-cols-2 gap-2">
              <Labeled label="เบอร์โทร">
                <input type="tel" value={profile.phone} onChange={(e) => set('phone', e.target.value)} maxLength={20} placeholder="081-234-5678" className={field} />
              </Labeled>
              <Labeled label="LINE ID">
                <input value={profile.lineId} onChange={(e) => set('lineId', e.target.value)} maxLength={40} placeholder="@baansuan หรือ ไอดีส่วนตัว" className={field} />
              </Labeled>
              <Labeled label="อีเมล">
                <input type="email" value={profile.email} onChange={(e) => set('email', e.target.value)} maxLength={120} placeholder="shop@example.com" className={field} />
              </Labeled>
              <Labeled label="เว็บไซต์">
                <input type="url" value={profile.website} onChange={(e) => set('website', e.target.value)} maxLength={300} placeholder="https://" className={field} />
              </Labeled>
            </div>
          </Section>

          <Section title="ช่องทางอื่นๆ (โซเชียลมีเดีย)">
            <div className="grid sm:grid-cols-2 gap-2">
              {SOCIALS.map((s) => (
                <Labeled key={s.key} label={s.label}>
                  <input type="url" value={profile[s.key]} onChange={(e) => set(s.key, e.target.value)} maxLength={300} placeholder={`https://${s.hosts[0]}/...`} className={field} />
                </Labeled>
              ))}
            </div>
          </Section>

          <Section title="รายละเอียดเพิ่มเติม">
            <div className="space-y-2">
              <Labeled label="เกี่ยวกับเรา">
                <textarea value={profile.about} onChange={(e) => set('about', e.target.value)} maxLength={L.about} rows={3} className={`${field} resize-none`} />
              </Labeled>
              <Labeled label={`จุดเด่นของเรา (บรรทัดละ 1 ข้อ ไม่เกิน ${L.highlights} ข้อ)`}>
                <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={4} placeholder={'วัตถุดิบธรรมชาติ ปลอดสาร\nคัดสรรคุณภาพทุกขั้นตอน'} className={`${field} resize-none`} />
              </Labeled>
              <div className="grid sm:grid-cols-2 gap-2">
                <Labeled label="พื้นที่ให้บริการ">
                  <input value={profile.serviceArea} onChange={(e) => set('serviceArea', e.target.value)} maxLength={L.serviceArea} placeholder="ทั่วประเทศไทย" className={field} />
                </Labeled>
                <Labeled label="การจัดส่ง">
                  <input value={profile.shipping} onChange={(e) => set('shipping', e.target.value)} maxLength={L.shipping} placeholder="2-5 วัน (ตามพื้นที่)" className={field} />
                </Labeled>
              </div>
            </div>
          </Section>
        </div>

        <div className="px-5 py-3 bg-[#09080e] border-t border-purple-900/30 space-y-2">
          {error && <p className="text-rose-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-stone-800 text-stone-200 text-xs cursor-pointer hover:bg-stone-700">
              ยกเลิก
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl font-bold text-white text-xs bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึกโปรไฟล์บาน
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-bold text-stone-200 text-sm">{title}</h3>
        {hint && <p className="text-[10px] text-stone-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-stone-400 text-[11px]">{label}</span>
      {children}
    </label>
  )
}

/** A picked image (shrunk in the browser) with a remove button; '' means empty. */
function ImageSlot(props: {
  value: string
  onChange: (url: string) => void
  onError: (message: string) => void
  size: number
  square?: boolean
  className: string
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (file?: File) => {
    if (input.current) input.current.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return props.onError('กรุณาเลือกไฟล์รูปภาพ')
    if (file.size > MAX_PICK_BYTES) return props.onError('กรุณาเลือกไฟล์ภาพขนาดไม่เกิน 20MB')
    setBusy(true)
    try {
      props.onChange(await compressImage(file, props.size, 0.82, props.square))
      props.onError('')
    } catch {
      props.onError('ไม่สามารถอ่านรูปนี้ได้ กรุณาเลือกไฟล์ JPG/PNG อื่น')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={`relative shrink-0 overflow-hidden border border-dashed border-purple-700/60 bg-stone-950 ${props.className}`}>
      <button type="button" onClick={() => input.current?.click()} className="w-full h-full flex flex-col items-center justify-center text-stone-500 hover:text-purple-300 cursor-pointer" title="เลือกรูป">
        {busy ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : props.value ? (
          <img src={props.value} alt="" className="w-full h-full object-cover" />
        ) : (
          <>
            <ImagePlus className="w-5 h-5" />
            {props.label && <span className="text-[10px] mt-0.5">{props.label}</span>}
          </>
        )}
      </button>
      {props.value && !busy && (
        <button
          type="button"
          onClick={() => props.onChange('')}
          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-stone-200 hover:text-rose-300 cursor-pointer"
          aria-label="ลบรูป"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}
