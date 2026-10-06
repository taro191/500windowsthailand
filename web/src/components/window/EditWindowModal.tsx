import { useState } from 'react'
import { Camera, Check, CircleAlert, Upload, X } from 'lucide-react'
import type { CategoryId, WindowItem } from '@/types'
import type { WindowEditInput } from '@/lib/store'
import { REGIONS_BY_ID } from '@/data/regions'
import { CATEGORIES, CATEGORY_IDS } from '@/data/categories'
import { DEMO_IMAGES } from '@/data/seedWindows'
import { todaysNote } from '@/lib/windowBadges'
import { compressImage } from '@/lib/browser'
import { KapsulepLogo } from '../KapsulepLogo'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

interface EditWindowModalProps {
  windowItem: WindowItem
  onClose: () => void
  onSubmitEdit: (windowId: number, input: WindowEditInput) => void
}

/** Owner's daily edit: image (optional), text, contact, link and today's status note. */
export function EditWindowModal({ windowItem, onClose, onSubmitEdit }: EditWindowModalProps) {
  const region = REGIONS_BY_ID[windowItem.region]
  const [imageUrl, setImageUrl] = useState(windowItem.imageUrl)
  const [caption, setCaption] = useState('')
  const [title, setTitle] = useState(windowItem.title)
  const [category, setCategory] = useState<CategoryId>(windowItem.category)
  const [province, setProvince] = useState(windowItem.province || region?.provinces[0] || '')
  const [contact, setContact] = useState(windowItem.ownerContact || '')
  const [description, setDescription] = useState(windowItem.description)
  const [externalLink, setExternalLink] = useState(windowItem.externalLink || '')
  const [dailyNote, setDailyNote] = useState(todaysNote(windowItem) || '')
  const [error, setError] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const imageChanged = imageUrl !== windowItem.imageUrl
  const code = windowItem.code || `#${windowItem.id.toString().padStart(3, '0')}`

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('กรุณาระบุชื่อหน้าต่าง')
      return
    }
    if (!acceptedTerms) {
      setError('กรุณายืนยันว่าภาพถ่ายและข้อความเป็นไปตามเงื่อนไขที่กำหนด')
      return
    }
    onSubmitEdit(windowItem.id, {
      title: title.trim(),
      description: description.trim(),
      category,
      province,
      ownerContact: contact.trim() || undefined,
      externalLink: externalLink.trim() || undefined,
      dailyNote: dailyNote.trim() || undefined,
      imageUrl: imageChanged ? imageUrl : undefined,
      caption: caption.trim() || undefined,
    })
  }

  const handleFile = (file?: File) => {
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('ขนาดไฟล์ต้องไม่เกิน 20MB')
      return
    }
    setError('')
    compressImage(file)
      .then(setImageUrl)
      .catch(() => setError('ไม่สามารถอ่านรูปนี้ได้ กรุณาเลือกไฟล์ JPG/PNG อื่น'))
  }

  const inputClass =
    'w-full bg-stone-950 border border-stone-700 text-stone-100 px-3 py-2 rounded-lg focus:outline-none focus:border-rose-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="relative w-full max-w-2xl bg-[#110e1a] border border-purple-900/50 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-2.5">
            <KapsulepLogo size={28} showGlow />
            <span className="font-bold text-stone-100 text-sm sm:text-base font-['Outfit',sans-serif]">
              แก้ไขรูปภาพและข้อความ (บาน {code})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          <div>
            <label className="block text-stone-300 font-semibold mb-2">รูปภาพ (ไม่เปลี่ยนก็ได้ ถ้าต้องการแก้ไขเฉพาะข้อความ)</label>
            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-stone-400">ภาพปัจจุบัน</span>
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-stone-950 border border-stone-800">
                  <img src={windowItem.imageUrl} alt="ภาพเดิม" className="w-full h-full object-cover opacity-70" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={`text-[11px] font-medium ${imageChanged ? 'text-rose-300' : 'text-stone-400'}`}>
                  {imageChanged ? 'ภาพใหม่ที่จะแสดง' : 'ยังไม่ได้เลือกภาพใหม่'}
                </span>
                <div
                  className={`aspect-[4/3] rounded-xl overflow-hidden bg-stone-950 border-2 ${imageChanged ? 'border-rose-500/80' : 'border-stone-800'}`}
                >
                  <img src={imageUrl} alt="ภาพใหม่" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
            <div className="mt-2 space-y-2">
              <label className="flex items-center justify-center gap-2 py-2 px-3 bg-stone-800 hover:bg-stone-750 border border-stone-700 rounded-lg text-xs font-medium text-stone-200 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-rose-400" />
                <span>อัปโหลดรูปภาพใหม่จากอุปกรณ์ของคุณ</span>
                <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setImageUrl(windowItem.imageUrl)}
                  className="shrink-0 px-2 h-12 rounded-lg border border-stone-700 text-[10px] text-stone-300 hover:border-rose-400 cursor-pointer"
                >
                  ใช้ภาพเดิม
                </button>
                {DEMO_IMAGES.map((url) => (
                  <button
                    type="button"
                    key={url}
                    onClick={() => setImageUrl(url)}
                    className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer ${imageUrl === url ? 'ring-2 ring-rose-400 border-rose-300' : 'border-stone-700 opacity-60 hover:opacity-100'}`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              {imageChanged && (
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="คำบรรยายภาพใหม่สำหรับประวัติภาพ (ไม่บังคับ)"
                  className={inputClass}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-stone-300 font-medium mb-1">
                ชื่อหน้าต่าง / ชื่อร้าน / ชื่อผลงาน <span className="text-rose-400">*</span>
              </label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-stone-300 font-medium mb-1">หมวดหมู่</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)} className={inputClass}>
                {CATEGORY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CATEGORIES[id].icon} {CATEGORIES[id].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-stone-300 font-medium mb-1">จังหวัดใน {region?.name || 'ภูมิภาคนี้'}</label>
              <select value={province} onChange={(e) => setProvince(e.target.value)} className={inputClass}>
                {region?.provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-stone-300 font-medium mb-1">ช่องทางติดต่อ (Line, IG, เบอร์โทร)</label>
              <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-stone-300 font-medium mb-1">เรื่องราวหรือคำบรรยายภาพ (Story)</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} font-light`} />
          </div>

          <div>
            <label className="block text-stone-300 font-medium mb-1">ลิงก์ภายนอก (เว็บไซต์, แฟนเพจ หรือ แผนที่)</label>
            <input
              type="url"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://..."
              className={`${inputClass} font-mono text-xs`}
            />
          </div>

          <div>
            <label className="block text-stone-300 font-medium mb-1">
              🟢 ข้อความสถานะประจำวันนี้ (ไม่บังคับ · แสดงเป็นป้าย "อัปเดตวันนี้")
            </label>
            <input
              type="text"
              value={dailyNote}
              maxLength={80}
              onChange={(e) => setDailyNote(e.target.value)}
              placeholder="เช่น วันนี้ร้านเปิดถึง 5 โมงเย็น มีกุ้งแม่น้ำสด"
              className={inputClass}
            />
          </div>

          <div className="p-3 bg-stone-950 rounded-xl border border-purple-900/40 text-stone-300 text-xs flex items-start gap-2">
            <Check className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-light">
              <strong>เงื่อนไขสิทธิ์:</strong> แก้ไขรูปภาพและข้อความได้ <strong>วันละ 1 ครั้งเท่านั้น</strong> (นับ 24
              ชั่วโมงจากการกดยืนยัน) คุณสามารถแก้ไขหลายอย่างพร้อมกันได้ในครั้งเดียว
            </p>
          </div>

          <div className="p-3 rounded-xl bg-stone-950 border border-stone-850">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-rose-500 shrink-0"
              />
              <span className="text-[11px] leading-relaxed text-stone-200 font-light">
                ข้าพเจ้ายืนยันว่าภาพถ่ายและข้อความที่แก้ไขเป็นไปตามเงื่อนไข (ไม่อนาจาร, ไม่รุนแรง, ไม่ละเมิด PDPA, ไม่ผิดกฎหมายไทย)
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!acceptedTerms}
            className={`w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 shadow-lg shadow-rose-500/20 cursor-pointer transition-all flex items-center justify-center gap-2 ${acceptedTerms ? '' : 'opacity-40 !cursor-not-allowed'}`}
          >
            <Camera className="w-4 h-4" />
            <span>ยืนยันการแก้ไข (ใช้สิทธิ์ของวันนี้)</span>
          </button>
        </form>
      </div>
    </div>
  )
}
