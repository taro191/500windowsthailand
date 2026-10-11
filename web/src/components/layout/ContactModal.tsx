import { useState } from 'react'
import { CheckCircle2, Clock, Facebook, Loader2, Mail, MapPin, MessageCircle, Phone, Send, X } from 'lucide-react'
import type { User } from '@shared/types'
import { CONTACT_SUBJECTS, useSettings } from '@/lib/settings'
import { sendContactMessage, type ContactMessage } from '@/lib/store'

interface ContactModalProps {
  currentUser: User | null
  onClose: () => void
}

const field =
  'w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 text-sm placeholder:text-stone-600 focus:outline-none focus:border-amber-400'

/** "Contact us": the company's contact details, and a form whose messages go to the admins' LINE. */
export function ContactModal({ currentUser, onClose }: ContactModalProps) {
  const { contact } = useSettings()
  const [form, setForm] = useState<ContactMessage>({
    name: currentUser?.name ?? '',
    email: currentUser?.email ?? '',
    phone: currentUser?.phone ?? '',
    subject: CONTACT_SUBJECTS[0],
    message: '',
    website: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const set = (key: keyof ContactMessage) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('กรุณากรอกชื่อ')
    if (!form.email.trim() && !form.phone.trim()) return setError('กรุณากรอกอีเมลหรือเบอร์โทรศัพท์อย่างน้อย 1 ช่องทาง เพื่อให้ทีมงานติดต่อกลับ')
    if (form.message.trim().length < 5) return setError('กรุณาพิมพ์ข้อความที่ต้องการติดต่อ')
    setError('')
    setBusy(true)
    const result = await sendContactMessage(form)
    setBusy(false)
    if (!result.success) return setError(result.error || 'ส่งข้อความไม่สำเร็จ')
    setSent(true)
  }

  const details = [
    contact.phone && { icon: Phone, label: 'โทรศัพท์', value: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, '')}` },
    contact.email && { icon: Mail, label: 'อีเมล', value: contact.email, href: `mailto:${contact.email}` },
    contact.lineId && { icon: MessageCircle, label: 'LINE', value: contact.lineId, href: contact.lineUrl || undefined },
    contact.facebookUrl && { icon: Facebook, label: 'Facebook', value: contact.facebookUrl.replace(/^https:\/\/(www\.)?/, ''), href: contact.facebookUrl },
    contact.openHours && { icon: Clock, label: 'เวลาทำการ', value: contact.openHours },
    contact.address && { icon: MapPin, label: 'ที่อยู่', value: contact.address },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 font-['Plus_Jakarta_Sans','Prompt',sans-serif]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0e0b17] border border-purple-900/40 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="font-bold text-stone-100 text-base font-['Prompt',sans-serif]">ติดต่อเรา</h2>
              <p className="text-xs text-stone-400 font-['Prompt',sans-serif]">{contact.companyName || 'ทีมงาน 500 Windows to Thailand'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-sm font-['Prompt',sans-serif]">
          {details.length > 0 && (
            <ul className="space-y-2">
              {details.map(({ icon: Icon, label, value, href }) => (
                <li key={label} className="flex items-start gap-3">
                  <Icon className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                  <span className="w-20 shrink-0 text-stone-400">{label}</span>
                  {href ? (
                    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="text-stone-100 hover:text-amber-300 break-all">
                      {value}
                    </a>
                  ) : (
                    <span className="text-stone-100 whitespace-pre-line">{value}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!contact.formEnabled ? null : sent ? (
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-bold text-emerald-300">ส่งข้อความเรียบร้อยแล้ว</p>
              <p className="text-xs text-stone-400">ทีมงานจะติดต่อกลับโดยเร็วที่สุด</p>
              <button onClick={onClose} className="mt-1 px-4 py-1.5 rounded-lg bg-stone-800 text-stone-200 text-xs cursor-pointer hover:bg-stone-700">
                ปิด
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-2.5 pt-3 border-t border-purple-900/30">
              <h3 className="font-bold text-stone-200">ส่งข้อความถึงทีมงาน</h3>
              <input value={form.name} onChange={set('name')} placeholder="ชื่อ-นามสกุล *" maxLength={100} className={field} />
              <div className="grid sm:grid-cols-2 gap-2.5">
                <input type="email" value={form.email} onChange={set('email')} placeholder="อีเมล" maxLength={200} className={field} />
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="เบอร์โทรศัพท์" maxLength={30} className={field} />
              </div>
              <select value={form.subject} onChange={set('subject')} className={field}>
                {CONTACT_SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <textarea value={form.message} onChange={set('message')} placeholder="ข้อความ *" rows={4} maxLength={2000} className={field} />
              {/* Honeypot: hidden from people, filled in by bots. */}
              <input value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
              {error && <p className="text-xs text-rose-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} ส่งข้อความ
              </button>
              <p className="text-[11px] text-stone-500 text-center">กรอกอีเมลหรือเบอร์โทรอย่างน้อย 1 ช่องทาง เพื่อให้ทีมงานติดต่อกลับ</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
