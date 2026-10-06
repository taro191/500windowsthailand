import { useState } from 'react'
import { CircleAlert, Image as ImageIcon, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import type { AuthMode, CategoryId, Quota, User, WindowContentInput, WindowItem } from '@/types'
import { REGIONS_BY_ID } from '@/data/regions'
import { CATEGORIES, CATEGORY_IDS } from '@/data/categories'
import { DEMO_IMAGES } from '@/data/seedWindows'
import { maskCitizenId } from '@/lib/identity'
import { compressImage } from '@/lib/browser'
import { KapsulepLogo } from '../KapsulepLogo'
import { ContentGuidelines } from './ContentGuidelines'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

interface ClaimWindowModalProps {
  windowItem: WindowItem
  currentUser: User | null
  quota: Quota
  onClose: () => void
  /** Called with the content; the parent then asks how to pay. */
  onSubmitClaim: (windowId: number, content: WindowContentInput) => void
  onOpenAuth: (mode: AuthMode) => void
  onOpenKyc: () => void
}

export function ClaimWindowModal({
  windowItem,
  currentUser,
  quota,
  onClose,
  onSubmitClaim,
  onOpenAuth,
  onOpenKyc,
}: ClaimWindowModalProps) {
  const region = REGIONS_BY_ID[windowItem.region]
  const isThailand = windowItem.region === 'thailand'
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CategoryId>('cafe_lifestyle')
  const [province, setProvince] = useState(region?.provinces[0] || 'กรุงเทพมหานคร')
  const [contact, setContact] = useState('')
  const [externalLink, setExternalLink] = useState('')
  const [imageUrl, setImageUrl] = useState(DEMO_IMAGES[0])
  const [error, setError] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const price = windowItem.claimPrice || 500
  const hasEnoughBalance = currentUser ? currentUser.balance >= price : false
  const isVerified = currentUser?.isVerified
  const canAcquireHere = isThailand ? quota.canAcquireThailand : quota.canAcquireRegional
  const code = windowItem.code || `#${windowItem.id.toString().padStart(3, '0')}`

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) {
      onOpenAuth('login')
      return
    }
    if (!isVerified) {
      setError('ตามข้อบังคับระบบ: ต้องทำการยืนยันตัวตนด้วยบัตรประชาชน 13 หลักและเบอร์โทรศัพท์ก่อนจับจองหน้าต่าง')
      onOpenKyc()
      return
    }
    if (!canAcquireHere) {
      setError(
        isThailand
          ? 'คุณมีหน้าต่างบานประเทศไทยครบ 1 บานตามโควตาสูงสุดแล้ว'
          : `คุณมีหน้าต่างบานภูมิภาคครบ 1 บานตามโควตาสูงสุดแล้ว (${quota.regionalWindow?.code})`,
      )
      return
    }
    if (!acceptedTerms) {
      setError('กรุณายืนยันว่าภาพถ่ายและข้อความเป็นไปตามเงื่อนไขที่กำหนด')
      return
    }
    if (!imageUrl) {
      setError('กรุณาเลือกหรืออัปโหลดรูปภาพประจำหน้าต่าง')
      return
    }
    onSubmitClaim(windowItem.id, {
      title: title.trim() || `หน้าต่างของ ${currentUser.name}`,
      description: description.trim() || 'บันทึกภาพถ่ายและเรื่องราวส่วนตัวในหน้าต่างประเทศไทย',
      imageUrl,
      category,
      province,
      ownerContact: contact.trim() || undefined,
      externalLink: externalLink.trim() || undefined,
    })
  }

  const handleFile = (file?: File) => {
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('กรุณาเลือกไฟล์ภาพขนาดไม่เกิน 20MB')
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
              จับจองหน้าต่างบานที่ {code} ({region?.icon} {region?.name})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!currentUser && (
          <div className="p-4 mx-5 mt-4 rounded-xl bg-purple-950/40 border border-purple-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-rose-300 block">ยังไม่ได้เข้าสู่ระบบ</span>
              <span className="text-stone-300 text-[11px] font-light">
                กรุณาเข้าสู่ระบบ หรือสมัครสมาชิกใหม่เพื่อจับจองหน้าต่างบานนี้
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 rounded-lg font-semibold"
              >
                เข้าสู่ระบบ
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-90 text-white rounded-lg font-bold"
              >
                สมัครสมาชิก
              </button>
            </div>
          </div>
        )}

        {currentUser && (
          <div className="p-3.5 mx-5 mt-3 rounded-xl bg-stone-950 border border-stone-850 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-stone-300 font-medium">
                โควตาการถือครอง ({currentUser.name} · {maskCitizenId(currentUser.citizenId) || 'ยังไม่ระบุ'}):
              </span>
              <span className="font-mono text-rose-400 font-bold">ถือครองรวม {quota.totalCount}/2 บาน</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className={`p-2 rounded border ${isThailand ? 'border-rose-500/60 bg-rose-950/20' : 'border-stone-800'}`}>
                <span>🇹🇭 ประเทศไทย: </span>
                <strong className={quota.thailandCount >= 1 ? 'text-rose-400' : 'text-emerald-400'}>
                  {quota.thailandCount}/1 บาน
                </strong>
                {isThailand && (
                  <span className="block text-[9px] text-rose-300 font-sans mt-0.5">← บานที่คุณกำลังจะจับจอง</span>
                )}
              </div>
              <div className={`p-2 rounded border ${isThailand ? 'border-stone-800' : 'border-purple-500/60 bg-purple-950/20'}`}>
                <span>🗺️ ภูมิภาค: </span>
                <strong className={quota.regionalCount >= 1 ? 'text-rose-400' : 'text-emerald-400'}>
                  {quota.regionalCount}/1 บาน
                </strong>
                {!isThailand && (
                  <span className="block text-[9px] text-purple-300 font-sans mt-0.5">← บานที่คุณกำลังจะจับจอง</span>
                )}
              </div>
            </div>
            {!isVerified && (
              <div className="pt-2 border-t border-stone-850 flex items-center justify-between text-rose-300">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>ยังไม่ได้ยืนยันตัวตน (ต้องยืนยันตัวตนก่อนชำระเงิน)</span>
                </span>
                <button
                  type="button"
                  onClick={onOpenKyc}
                  className="px-2.5 py-1 rounded bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-90 text-white font-semibold text-[10px] cursor-pointer shadow-sm"
                >
                  ยืนยันตัวตน (KYC)
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
          <div>
            <label className="block text-stone-300 font-semibold mb-2">
              1. เลือกภาพถ่ายส่วนตัวของคุณ <span className="text-rose-400">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-40 h-32 rounded-xl bg-stone-950 border-2 border-stone-800 overflow-hidden relative shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="พรีวิว" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-600">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute bottom-1 right-1 bg-stone-950/80 px-1.5 py-0.5 rounded text-[10px] text-stone-400">
                  พรีวิวภาพ
                </div>
              </div>
              <div className="flex-1 w-full space-y-2.5">
                <label className="flex items-center justify-center gap-2 py-2 px-3 bg-stone-800 hover:bg-stone-750 border border-stone-700 rounded-lg text-xs font-medium text-stone-200 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-rose-400" />
                  <span>อัปโหลดรูปภาพจากอุปกรณ์</span>
                  <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />
                </label>
                <div>
                  <span className="text-[11px] text-stone-400 block mb-1.5">หรือเลือกภาพถ่ายไทยระดับพรีเมียม:</span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {DEMO_IMAGES.slice(0, 6).map((url) => (
                      <button
                        type="button"
                        key={url}
                        onClick={() => setImageUrl(url)}
                        className={`w-11 h-11 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer ${imageUrl === url ? 'ring-2 ring-rose-400 border-rose-300' : 'border-stone-700 opacity-60 hover:opacity-100'}`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-stone-300 font-medium mb-1">
                ชื่อหน้าต่าง / ชื่อร้าน / ชื่อผลงาน <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น กาแฟดริปริมดอย, ภาพครอบครัว 2569"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-stone-300 font-medium mb-1">
                หมวดหมู่ <span className="text-rose-400">*</span>
              </label>
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
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="เช่น @mycafe_th หรือ 081-xxx-xxxx"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-stone-300 font-medium mb-1">เรื่องราวหรือคำบรรยายภาพ (Story)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="บอกเล่าความทรงจำ แนะนำสินค้า หรือเล่าเรื่องราวที่คุณอยากให้ผู้คนทั่วประเทศได้อ่าน..."
              className={`${inputClass} font-light`}
            />
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

          <div className="p-3.5 bg-stone-950 rounded-xl border border-stone-850 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-400">ค่าจับจองกรรมสิทธิ์บานหน้าต่าง:</span>
              <span className="font-mono font-bold text-rose-300 text-sm">฿{price.toLocaleString()} THB</span>
            </div>
            {currentUser && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400">ยอดเงินในกระเป๋าของคุณ:</span>
                <span className={`font-mono font-bold ${hasEnoughBalance ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ฿{currentUser.balance.toLocaleString()} THB
                </span>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-stone-950 border border-purple-900/40 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <span>เงื่อนไขภาพที่ลงได้ (Content Guidelines & PDPA)</span>
            </div>
            <ContentGuidelines />
            <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-stone-850">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-rose-500 shrink-0"
              />
              <span className="text-[11px] leading-relaxed text-stone-200 font-light">
                ข้าพเจ้ายืนยันว่าภาพและข้อความที่ลงเป็นไปตามเงื่อนไขข้างต้น มีสิทธิ์ใช้ภาพนี้ และรับทราบว่าผู้ใช้ 1 คน
                (อ้างอิงเลขบัตรประชาชน) สามารถมีหน้าต่างได้ไม่เกิน 2 บาน
              </span>
            </label>
          </div>

          {currentUser ? (
            <button
              type="submit"
              disabled={!acceptedTerms || !canAcquireHere}
              className={`w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${acceptedTerms && canAcquireHere ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 shadow-rose-500/20' : 'bg-stone-800 text-stone-500 cursor-not-allowed'}`}
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {canAcquireHere
                  ? `ยืนยันการจับจอง และไปชำระเงิน (฿${price.toLocaleString()})`
                  : isThailand
                    ? 'โควตาบานประเทศไทยเต็มแล้ว (จำกัด 1 บาน)'
                    : 'โควตาบานภูมิภาคเต็มแล้ว (จำกัด 1 บาน)'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>เข้าสู่ระบบหรือสมัครสมาชิกเพื่อชำระเงิน</span>
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
