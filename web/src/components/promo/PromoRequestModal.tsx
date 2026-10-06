import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, CircleCheck, ImagePlus, Megaphone, X, type LucideIcon } from 'lucide-react'
import type { AuthMode, User } from '@/types'
import {
  isValidPromoStartDate,
  loadPromoRequests,
  localDateKey,
  PROMO_ROUND_OPTIONS,
  PROMO_SIZES,
  promoPrice,
  promoRoundsAvailable,
  resizeImageFile,
  type PromoRequest,
} from '@/lib/promo'
import { payPromoRequest } from '@/lib/store'
import { PaymentPanel } from '../payment/PaymentPanel'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { PromoLayoutPreview } from './PromoLayoutPreview'

interface PromoRequestModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: User | null
  onOpenAuth: (mode: AuthMode) => void
  /** Called after the request is paid, with the payer's updated wallet balance. */
  onPaid: (user: User) => void
}

const MAX_TAGLINE = 1200
const MAX_BRAND = 80
const MAX_CONTACT = 160
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const money = (value: number) => `${value.toLocaleString('th-TH')} บาท`
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { dateStyle: 'medium' })
const Icon = ({ icon: Component, className = 'promo-icon' }: { icon: LucideIcon; className?: string }) => (
  <Component className={className} aria-hidden />
)

/** "โปรโมท": request a sponsored placement in windows 481–486 for one or more 6-hour rounds. */
export function PromoRequestModal({ isOpen, onClose, currentUser, onOpenAuth, onPaid }: PromoRequestModalProps) {
  const [size, setSize] = useState(3)
  const [rounds, setRounds] = useState(1)
  const [scheduleMode, setScheduleMode] = useState<'today' | 'calendar'>('today')
  const [startDate, setStartDate] = useState(() => localDateKey())
  const [calendarMonth, setCalendarMonth] = useState(() => localDateKey().slice(0, 7))
  const [brand, setBrand] = useState('')
  const [contact, setContact] = useState('')
  const [tagline, setTagline] = useState('')
  const [link, setLink] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<PromoRequest | null>(null)
  /** Valid request waiting for payment; it is only stored once paid. */
  const [pendingRequest, setPendingRequest] = useState<PromoRequest | null>(null)
  const [history, setHistory] = useState<PromoRequest[]>([])
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const uploadVersion = useRef(0)
  const submitted = useRef(false)

  useDialogFocus(isOpen, dialogRef, onClose)
  const currentUserId = currentUser?.id

  useEffect(() => {
    if (!isOpen) return
    setSaved(null)
    setPendingRequest(null)
    setCopied(false)
    setTermsAccepted(false)
    setError('')
    submitted.current = false
    const requests = loadPromoRequests()
    setHistory(currentUserId && Array.isArray(requests) ? requests.filter((r) => r.userId === currentUserId) : [])
    return () => {
      // Ignore any image still being resized when the dialog closes.
      uploadVersion.current++
      setUploading(false)
    }
    // Reset only when opened or the account changes, not when the balance updates after paying.
  }, [isOpen, currentUserId])

  if (!isOpen) return null

  const price = promoPrice(size, rounds)
  const today = localDateKey()
  const currentMonth = today.slice(0, 7)
  const maxMonthDate = new Date()
  maxMonthDate.setMonth(maxMonthDate.getMonth() + 11)
  const maximumMonth = localDateKey(maxMonthDate).slice(0, 7)
  const requests = loadPromoRequests()
  const availableRounds = startDate < today ? 0 : promoRoundsAvailable(startDate, requests)

  const [calendarYear, calendarMonthNumber] = calendarMonth.split('-').map(Number)
  const monthStart = new Date(calendarYear, calendarMonthNumber - 1, 1, 12)
  const daysInMonth = new Date(calendarYear, calendarMonthNumber, 0).getDate()
  const leadingDays = monthStart.getDay()
  const calendarDays = Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, index) => {
    const dayNumber = index - leadingDays + 1
    if (dayNumber < 1 || dayNumber > daysInMonth) return { key: `empty-${index}`, inMonth: false as const }
    const value = `${calendarMonth}-${String(dayNumber).padStart(2, '0')}`
    const isPast = value < today
    return {
      key: value,
      inMonth: true as const,
      value,
      dayNumber,
      isPast,
      available: isPast ? 0 : promoRoundsAvailable(value, requests),
    }
  })
  const calendarTitle = monthStart.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  const moveCalendarMonth = (offset: number) => {
    const next = localDateKey(new Date(calendarYear, calendarMonthNumber - 1 + offset, 1, 12)).slice(0, 7)
    if (next >= currentMonth && next <= maximumMonth) setCalendarMonth(next)
  }

  const summaryText = saved
    ? [
        'คำขอโปรโมท',
        `เลขคำขอ: ${saved.id}`,
        `แบรนด์: ${saved.brand}`,
        `จำนวน: ${saved.size} บาน`,
        `ราคา: ${money(saved.price)}`,
        `จำนวนรอบ: ${saved.rounds} รอบ (${saved.durationHours} ชั่วโมง)`,
        `วันที่โปรโมท: ${dateLabel(saved.startDate)}`,
        `จำนวนรูป: ${saved.images.length} รูป`,
        `รายละเอียด: ${saved.tagline || '—'}`,
        `ลิงก์: ${saved.link || '—'}`,
        `ติดต่อกลับ: ${saved.contact || 'ไม่ได้ระบุ'}`,
        `ชำระเงินแล้ว: ${money(saved.payment?.amount ?? saved.price)}`,
        'สถานะ: รอตรวจสอบคำขอ (ถ้าไม่อนุมัติ คืนเงินเต็มจำนวนเข้ากระเป๋า)',
      ].join('\n')
    : ''

  /** Any edit clears the current error. */
  const change = <T,>(setter: (value: T) => void, value: T) => {
    setter(value)
    setError('')
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length || uploading) return
    if (files.length + images.length > size) {
      setError(`แพ็กเกจ ${size} บานเพิ่มรูปได้สูงสุด ${size} รูป กรุณาเลือกใหม่หรือลบรูปเดิม`)
      return
    }
    if (files.some((f) => !ACCEPTED_IMAGE_TYPES.includes(f.type))) {
      setError('รองรับเฉพาะรูป JPG, PNG และ WebP')
      return
    }
    if (files.some((f) => f.size > MAX_IMAGE_BYTES)) {
      setError('แต่ละรูปต้องมีขนาดไม่เกิน 10 MB')
      return
    }
    const version = ++uploadVersion.current
    setUploading(true)
    setError('')
    try {
      const results: string[] = []
      for (const file of files) results.push(await resizeImageFile(file))
      if (version === uploadVersion.current) setImages((previous) => [...previous, ...results])
    } catch {
      if (version === uploadVersion.current) setError('อ่านรูปไม่สำเร็จ กรุณาลองรูปอื่น')
    } finally {
      if (version === uploadVersion.current) setUploading(false)
    }
  }

  const validate = (): string | null => {
    if (!brand.trim() || brand.length > MAX_BRAND || tagline.length > MAX_TAGLINE || contact.length > MAX_CONTACT)
      return 'กรุณาระบุชื่อแบรนด์ และตรวจสอบความยาวข้อมูลให้ไม่เกินที่กำหนด'
    if (!PROMO_SIZES.includes(size) || !PROMO_ROUND_OPTIONS.includes(rounds)) return 'กรุณาเลือกจำนวนบานและจำนวนรอบที่รองรับ'
    if (!isValidPromoStartDate(startDate)) return 'กรุณาเลือกวันโปรโมทเป็นวันนี้หรือวันในอนาคต'
    if (availableRounds < rounds) return `วันที่เลือกเหลือ ${availableRounds} รอบ กรุณาลดจำนวนรอบหรือเลือกวันอื่น`
    if (link.trim()) {
      try {
        const url = new URL(link.trim())
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || link.length > 2048)
          throw new Error('url')
      } catch {
        return 'ลิงก์ต้องเป็นเว็บไซต์ http:// หรือ https:// ที่ถูกต้อง'
      }
    }
    if (images.length > size) return `กรุณาลดจำนวนรูปให้ไม่เกิน ${size} รูปก่อนส่งคำขอ`
    if (!termsAccepted) return 'กรุณาตรวจสอบข้อมูลและยอมรับเงื่อนไข พร้อมรับผิดชอบเนื้อหาที่นำเสนอ'
    return null
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentUser) {
      onClose()
      onOpenAuth('login')
      return
    }
    if (submitted.current || uploading) return
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    const now = new Date().toISOString()
    const request: PromoRequest = {
      id: `promo_${crypto.randomUUID()}`,
      userId: currentUser.id,
      brand: brand.trim(),
      tagline: tagline.trim(),
      link: link.trim(),
      contact: contact.trim(),
      images: [...images],
      image: images[0] || '',
      size,
      price,
      rounds,
      durationHours: rounds * 6,
      scheduleMode,
      startDate,
      termsAccepted: true,
      termsAcceptedAt: now,
      createdAt: now,
      status: 'pending',
    }
    setError('')
    setPendingRequest(request)
  }

  /** Payment approved and request stored. */
  const handlePaid = (request: PromoRequest, user: User) => {
    submitted.current = true
    setSaved(request)
    setPendingRequest(null)
    setHistory((previous) => [request, ...previous])
    onPaid(user)
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('.promo-success-title')?.focus())
  }

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopied(true)
      setError('')
    } catch {
      setError('คัดลอกไม่สำเร็จ เปิดรายละเอียดที่บันทึกเพื่อเลือกและคัดลอกข้อความเองได้')
    }
  }

  return (
    <div className="promo-backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        className="promo-dialog"
        role="dialog"
        aria-modal
        aria-labelledby="promo-title"
        aria-describedby="promo-description"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="promo-handle" aria-hidden />
        <header className="promo-header">
          <span className="promo-brand-icon">
            <Icon icon={Megaphone} />
          </span>
          <div className="promo-header-text">
            <span className="promo-eyebrow">500 WINDOWS · PROMOTE</span>
            <h3 id="promo-title">ให้คนเห็นแบรนด์คุณ</h3>
            <p id="promo-description">เลือกจำนวนบาน · เลือกรอบ 6 ชั่วโมง · กำหนดวันโปรโมท</p>
          </div>
          <button type="button" className="promo-close" onClick={onClose} aria-label="ปิดโปรโมท">
            <Icon icon={X} />
          </button>
        </header>

        {saved ? (
          <div className="promo-success promo-scroll">
            <span className="promo-success-icon">
              <Icon icon={CircleCheck} />
            </span>
            <h4 tabIndex={-1} className="promo-success-title">
              บันทึกคำขอแล้ว
            </h4>
            <p>ชำระเงินและส่งคำขอเรียบร้อยแล้ว สถานะ: รอตรวจสอบคำขอ · ถ้าไม่อนุมัติ ระบบจะคืนเงินเต็มจำนวนเข้ากระเป๋าของคุณ</p>
            <div className="promo-request-summary">
              <strong>{saved.brand}</strong>
              <span>
                {saved.size} บาน · {saved.rounds} รอบ / {saved.durationHours} ชม. · {money(saved.price)}
              </span>
              <small>
                วันที่โปรโมท: {dateLabel(saved.startDate)} · {saved.images.length} รูป
              </small>
              {saved.contact && <small>ติดต่อกลับ: {saved.contact}</small>}
              <small>เลขคำขอ: {saved.id}</small>
              {saved.payment && (
                <small>
                  ชำระแล้ว: กระเป๋า {money(saved.payment.walletAmount)}
                  {saved.payment.externalAmount > 0 && ` + ${saved.payment.channelName} ${money(saved.payment.externalAmount)}`}
                </small>
              )}
            </div>
            <details className="promo-preview">
              <summary>
                <span>ดูรายละเอียดที่บันทึก</span>
                <Icon icon={ArrowRight} className="promo-chevron" />
              </summary>
              <pre className="promo-content-text promo-preview-content">{summaryText}</pre>
              {saved.images.length > 0 && <ImageGrid images={saved.images} altPrefix="รูปที่บันทึก" />}
            </details>
            <button type="button" className="promo-secondary" onClick={copySummary}>
              {copied ? 'คัดลอกรายละเอียดแล้ว' : 'คัดลอกรายละเอียดคำขอ'}
            </button>
            <span className="promo-subtle" role="status">
              {copied ? 'เก็บรายละเอียดนี้ไว้สำหรับอ้างอิงได้' : 'ตรวจสอบรายละเอียดที่บันทึกได้ด้านบน'}
            </span>
            {error && (
              <p className="promo-error" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="promo-text-button" onClick={onClose}>
              กลับไปดูหน้าต่าง
            </button>
          </div>
        ) : pendingRequest && currentUser ? (
          <div className="promo-scroll">
            <PromoPayment
              request={pendingRequest}
              payer={currentUser}
              onBack={() => setPendingRequest(null)}
              onPaid={handlePaid}
            />
          </div>
        ) : (
          <form className="promo-form" onSubmit={handleSubmit}>
            <div className="promo-scroll">
              <div className="promo-intro">
                <span className="promo-intro-icon">
                  <Icon icon={Megaphone} />
                </span>
                <div>
                  <strong>ราคาและเงื่อนไขการโปรโมท</strong>
                  <p>1 รอบใช้เวลา 6 ชั่วโมง ราคา 30 บาทต่อหน้าต่าง 1 บาน · เลือกแพ็กเกจ 2 / 3 / 4 / 6 บานได้เหมือนเดิม</p>
                </div>
              </div>

              <section className="promo-section">
                <SectionTitle number="01" title="เลือกแพ็กเกจโปรโมท" hint="30 บาท / บาน / รอบ" />
                <div className="promo-packages" role="group" aria-label="จำนวนบานที่ต้องการโปรโมท">
                  {PROMO_SIZES.map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`promo-package ${count === size ? 'is-selected' : ''}`}
                      aria-pressed={count === size}
                      disabled={uploading}
                      onClick={() => change(setSize, count)}
                    >
                      {count === 3 && <span className="promo-recommend">แนะนำ</span>}
                      <span className="promo-package-number">{count}</span>
                      <span className="promo-package-label">บาน</span>
                      <span className="promo-package-price">{money(promoPrice(count, 1))} / รอบ</span>
                      <span className="promo-radio" aria-hidden>
                        {count === size && <span />}
                      </span>
                    </button>
                  ))}
                </div>
                {images.length > size && (
                  <p className="promo-error" role="alert">
                    มี {images.length} รูป กรุณาลบให้เหลือไม่เกิน {size} รูปก่อนส่งคำขอ
                  </p>
                )}

                <div className="promo-schedule">
                  <div className="promo-section-heading">
                    <h4>เลือกรูปแบบการจอง</h4>
                    <span className="promo-subtle" role="status">
                      {availableRounds ? `วันที่เลือกว่าง ${availableRounds} รอบ` : 'วันที่เลือกเต็ม'}
                    </span>
                  </div>
                  <div className="promo-mode-tabs" role="group" aria-label="รูปแบบการเลือกวัน">
                    {(
                      [
                        ['today', 'โปรโมทวันนี้'],
                        ['calendar', 'เลือกวันจากปฏิทิน'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`promo-mode ${scheduleMode === mode ? 'is-selected' : ''}`}
                        aria-pressed={scheduleMode === mode}
                        onClick={() => {
                          setScheduleMode(mode)
                          if (mode === 'today') setStartDate(today)
                          else setCalendarMonth(startDate.slice(0, 7))
                          setError('')
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="promo-field">
                    <span className="promo-field-label">จำนวนรอบที่ต้องการใน 1 วัน</span>
                    <div className="promo-rounds" role="group" aria-label="จำนวนรอบต่อวัน">
                      {PROMO_ROUND_OPTIONS.map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`promo-round ${rounds === count ? 'is-selected' : ''}`}
                          aria-pressed={rounds === count}
                          disabled={count > availableRounds}
                          onClick={() => change(setRounds, count)}
                        >
                          <strong>{count} รอบ</strong>
                          <small>{count * 6} ชม.</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  {scheduleMode === 'calendar' && (
                    <div className="promo-calendar-wrap">
                      <div className="promo-calendar-header">
                        <button
                          type="button"
                          className="promo-month-button is-previous"
                          disabled={calendarMonth <= currentMonth}
                          onClick={() => moveCalendarMonth(-1)}
                          aria-label="เดือนก่อนหน้า"
                        >
                          <Icon icon={ArrowRight} />
                        </button>
                        <strong>{calendarTitle}</strong>
                        <button
                          type="button"
                          className="promo-month-button"
                          disabled={calendarMonth >= maximumMonth}
                          onClick={() => moveCalendarMonth(1)}
                          aria-label="เดือนถัดไป"
                        >
                          <Icon icon={ArrowRight} />
                        </button>
                      </div>
                      <div className="promo-weekdays" aria-hidden>
                        {WEEKDAYS.map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>
                      <div className="promo-calendar" role="grid" aria-label={`วันที่ว่าง ${calendarTitle}`}>
                        {calendarDays.map((day) =>
                          day.inMonth ? (
                            <button
                              key={day.key}
                              type="button"
                              role="gridcell"
                              className={`promo-day ${startDate === day.value ? 'is-selected' : ''} ${day.value === today ? 'is-today' : ''}`}
                              aria-label={`${dateLabel(day.value)} ${day.available ? `ว่าง ${day.available} รอบ` : day.isPast ? 'ผ่านมาแล้ว' : 'เต็ม'}`}
                              aria-pressed={startDate === day.value}
                              disabled={day.isPast || day.available === 0}
                              onClick={() => {
                                setStartDate(day.value)
                                setRounds((current) => Math.min(current, day.available))
                                setError('')
                              }}
                            >
                              <strong>{day.dayNumber}</strong>
                              <small>{day.available || '—'}</small>
                            </button>
                          ) : (
                            <span key={day.key} className="promo-day is-empty" aria-hidden />
                          ),
                        )}
                      </div>
                      <div className="promo-calendar-legend">
                        <span>ตัวเลขมุมล่าง = รอบว่าง</span>
                        <span>เลือกได้ล่วงหน้า 12 เดือน</span>
                      </div>
                    </div>
                  )}

                  <p className="promo-subtle">
                    {dateLabel(startDate)} · {rounds} รอบ ({rounds * 6} ชม.) · รวม {money(price)}
                  </p>
                </div>
              </section>

              <section className="promo-section">
                <SectionTitle number="02" title="ข้อมูลและเนื้อหาที่นำเสนอ" hint="ตรวจสอบก่อนส่ง" />
                <TextField
                  id="promo-brand"
                  label="ชื่อแบรนด์ / หัวข้อโปรโมท *"
                  value={brand}
                  onChange={(v) => change(setBrand, v)}
                  required
                  maxLength={MAX_BRAND}
                  placeholder="ชื่อแบรนด์หรือหัวข้อที่ต้องการแสดง"
                  autoComplete="organization"
                />
                <TextField
                  id="promo-contact"
                  label="ช่องทางติดต่อกลับ (ไม่บังคับ)"
                  value={contact}
                  onChange={(v) => change(setContact, v)}
                  maxLength={MAX_CONTACT}
                  placeholder="ช่องทางที่สะดวก เช่น เบอร์โทรหรือบัญชีโซเชียล"
                  autoComplete="off"
                />
                <label className="promo-field" htmlFor="promo-tagline">
                  <span className="promo-field-label">ข้อความโปรโมท / รายละเอียด</span>
                  <textarea
                    id="promo-tagline"
                    className="promo-input promo-textarea"
                    value={tagline}
                    onChange={(e) => change(setTagline, e.target.value)}
                    maxLength={MAX_TAGLINE}
                    rows={3}
                    placeholder="เล่าเรื่องแบรนด์ รายละเอียดสินค้า ข้อเสนอ และเงื่อนไขที่ลูกค้าควรทราบ"
                    aria-describedby="promo-text-count"
                  />
                  <span id="promo-text-count" className="promo-subtle">
                    {tagline.length.toLocaleString()} / 1,200 ตัวอักษร
                  </span>
                </label>
                <TextField
                  id="promo-link"
                  label="เว็บไซต์ / โซเชียล (ไม่บังคับ)"
                  value={link}
                  onChange={(v) => change(setLink, v)}
                  placeholder="https://"
                  type="url"
                  maxLength={2048}
                  inputMode="url"
                />

                <div className="promo-section-heading">
                  <h4>รูปภาพโปรโมท</h4>
                  <span className="promo-subtle" role="status">
                    {images.length} / {size} รูป
                  </span>
                </div>
                <label className="promo-upload">
                  <Icon icon={ImagePlus} />
                  <div>
                    <strong>{uploading ? 'กำลังเตรียมรูป…' : `เพิ่มรูปได้สูงสุด ${size} รูป`}</strong>
                    <small>เลือกหลายรูปได้ · JPG, PNG, WebP · รูปละไม่เกิน 10 MB</small>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    onChange={handleUpload}
                    disabled={uploading || images.length >= size}
                    aria-label="เพิ่มรูปโปรโมท"
                  />
                </label>
                {images.length > 0 && (
                  <ImageGrid
                    images={images}
                    altPrefix="รูปโปรโมท"
                    removeDisabled={uploading}
                    onRemove={(index) => change(setImages, images.filter((_, at) => at !== index))}
                  />
                )}
                <p className="promo-subtle">ไม่บังคับเพิ่มรูป รูปทั้งหมดจะเก็บในคำขอ ส่วนตัวอย่างและระบบแสดงผลเดิมใช้รูปแรก</p>
              </section>

              <section className="promo-section promo-terms">
                <SectionTitle number="03" title="เงื่อนไขและความรับผิดชอบ" />
                <p className="promo-subtle">
                  กรุณาตรวจสอบชื่อ ข้อความ รูป ลิงก์ ราคา และวันที่ก่อนส่ง เนื้อหาต้องเป็นจริง ไม่ผิดกฎหมาย ไม่ละเมิดสิทธิ์ผู้อื่น
                  และไม่ขัดต่อเงื่อนไขการใช้งาน
                </p>
                <label className="promo-consent">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => change(setTermsAccepted, e.target.checked)} />
                  <span>ฉันตรวจสอบข้อมูลแล้ว รับผิดชอบเนื้อหาที่นำเสนอเอง และยืนยันว่าไม่ขัดต่อเงื่อนไขการใช้งาน</span>
                </label>
              </section>

              <details className="promo-preview">
                <summary>
                  <span>ดูตัวอย่างก่อนส่งคำขอ</span>
                  <Icon icon={ArrowRight} className="promo-chevron" />
                </summary>
                <div className="promo-preview-content">
                  <PromoLayoutPreview size={size} offset={0} image={images[0] || ''} brand={brand} />
                  {tagline && <p className="promo-content-text promo-subtle">{tagline}</p>}
                  <p className="promo-subtle">ตัวอย่างตำแหน่งเท่านั้น ระบบสุ่มสลับรูปแบบทุกรอบ 6 ชั่วโมง</p>
                </div>
              </details>

              {history.length > 0 && <RequestHistory history={history} />}
            </div>

            <footer className="promo-footer">
              <div className="promo-footer-summary">
                <strong>
                  {size} บาน · {rounds} รอบ · {rounds * 6} ชม.
                </strong>
                <span aria-live="polite">รวม {money(price)}</span>
              </div>
              {error && (
                <p className="promo-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                formNoValidate={!currentUser}
                className="promo-primary"
                disabled={uploading || (!!currentUser && (!brand.trim() || !termsAccepted || images.length > size))}
              >
                <Icon icon={Megaphone} />
                {uploading ? 'กำลังเตรียมรูป…' : currentUser ? `ยืนยันข้อมูลและชำระเงิน ${money(price)}` : 'เข้าสู่ระบบเพื่อจองพื้นที่'}
                <Icon icon={ArrowRight} />
              </button>
              <p className="promo-footer-note">ชำระเงินตอนส่งคำขอ · ถ้าไม่อนุมัติ คืนเงินเต็มจำนวนเข้ากระเป๋า</p>
            </footer>
          </form>
        )}
      </section>
    </div>
  )
}

function SectionTitle({ number, title, hint }: { number: string; title: string; hint?: string }) {
  return (
    <div className="promo-section-heading">
      <span className="promo-step">{number}</span>
      <h4>{title}</h4>
      {hint && <span className="promo-subtle">{hint}</span>}
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  ...inputProps
}: { id: string; label: ReactNode; value: string; onChange: (value: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'value' | 'onChange'
>) {
  return (
    <label className="promo-field" htmlFor={id}>
      <span className="promo-field-label">{label}</span>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="promo-input" {...inputProps} />
    </label>
  )
}

function ImageGrid({
  images,
  altPrefix,
  onRemove,
  removeDisabled,
}: {
  images: string[]
  altPrefix: string
  onRemove?: (index: number) => void
  removeDisabled?: boolean
}) {
  return (
    <div className="promo-image-grid">
      {images.map((image, index) => (
        <div key={index} className="promo-image-card">
          <img src={image} alt={`${altPrefix} ${index + 1}`} />
          {onRemove !== undefined && (
            <button type="button" className="promo-image-remove" disabled={removeDisabled} aria-label={`ลบรูปที่ ${index + 1}`} onClick={() => onRemove(index)}>
              <Icon icon={X} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function RequestHistory({ history }: { history: PromoRequest[] }) {
  const statusLabel = (status: PromoRequest['status']) =>
    status === 'approved' ? 'อนุมัติแล้ว' : status === 'rejected' ? 'ไม่อนุมัติ' : 'รอตรวจสอบ'
  const durationLabel = (item: PromoRequest) =>
    item.rounds
      ? `${item.rounds} รอบ / ${item.durationHours || item.rounds * 6} ชม.`
      : item.duration
        ? `${item.duration} วัน (คำขอเดิม)`
        : 'ระยะเวลาไม่ระบุ'

  return (
    <details className="promo-history">
      <summary>
        <span>คำขอของฉัน</span>
        <small>{history.length} รายการ</small>
        <Icon icon={ArrowRight} className="promo-chevron" />
      </summary>
      {history.map((item) => (
        <div key={item.id} className="promo-history-row">
          <span>
            {item.brand}
            <small>
              {item.size} บาน · {new Date(item.createdAt).toLocaleDateString('th-TH')}
            </small>
            <small>
              {Number.isFinite(item.price) ? money(item.price) : 'ราคาไม่ระบุ'} · {durationLabel(item)}
            </small>
            <small>{item.startDate ? `เริ่ม ${dateLabel(item.startDate)}` : 'วันที่เริ่มไม่ระบุ (คำขอเดิม)'}</small>
          </span>
          <span className="promo-pill">{statusLabel(item.status)}</span>
        </div>
      ))}
    </details>
  )
}

/** Pays for the request (wallet first, rest through a channel) and stores it. */
function PromoPayment({
  request,
  payer,
  onBack,
  onPaid,
}: {
  request: PromoRequest
  payer: User
  onBack: () => void
  onPaid: (request: PromoRequest, user: User) => void
}) {
  return (
    <div className="space-y-3">
      <div className="promo-intro">
        <span className="promo-intro-icon">
          <Icon icon={Megaphone} />
        </span>
        <div>
          <strong>
            {request.brand} · {request.size} บาน · {request.rounds} รอบ ({request.durationHours} ชม.)
          </strong>
          <p>เริ่ม {dateLabel(request.startDate)} · ชำระตอนนี้ ถ้าไม่อนุมัติ ระบบคืนเงินเต็มจำนวนเข้ากระเป๋าเงินของคุณ</p>
        </div>
      </div>
      <PaymentPanel
        payer={payer}
        amount={request.price}
        itemLabel={`ค่าโปรโมท "${request.brand}"`}
        reference="PROMO"
        onCancel={onBack}
        onConfirm={(payment) => {
          const result = payPromoRequest(payer, request, payment)
          if (!result.success) return { success: false, error: result.error }
          onPaid(result.request, result.updatedUser)
          return { success: true }
        }}
        onPaid={() => {}}
      />
    </div>
  )
}
