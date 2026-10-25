import { useEffect, useRef, useState } from 'react'
import { lineUrl } from '@shared/windowProfile'
import { copyToClipboard } from '@/lib/browser'
import { emptyPromoDetails, safeHttpUrl, safeImageUrl, type PromoAd } from '@/lib/promo'
import { Lightbox } from '../Lightbox'

interface PromoDisplayProps {
  ad: PromoAd
  /** Preview of a request that isn't live yet (request dialog, admin review). */
  simulated?: boolean
  onClose: () => void
  /** "Promote your brand" link at the bottom (live ads only). */
  onStartPromo?: () => void
}

// Colours come from the promo theme variables (index.css, overridable by a site theme).
const line = 'border-[color-mix(in_srgb,var(--promo-page-text)_14%,transparent)]'
const chip = `inline-flex items-center gap-1.5 font-medium border ${line} bg-(--promo-page-media-bg) text-(--promo-page-text) px-4 py-2.5 rounded-full no-underline cursor-pointer text-[15px] leading-tight`
const accentBtn = '!bg-(--promo-page-highlight) !text-[#1a1200] !border-transparent'
const focus = 'focus-visible:outline-2 focus-visible:outline-(--promo-page-highlight) focus-visible:outline-offset-2'

const parseDay = (s: string, end: boolean) => {
  if (!s) return null
  const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}${end ? 'T23:59:59' : 'T00:00:00'}` : s)
  return Number.isNaN(t.getTime()) ? null : t
}
const dayLabel = (t: Date) => t.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

function contactInfo(raw = '') {
  const c = raw.trim()
  if (!c) return null
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return { href: `mailto:${c}`, label: `✉️ ${c}` }
  const digits = c.replace(/[\s-]/g, '')
  if (/^\+?\d{8,15}$/.test(digits)) return { href: `tel:${digits}`, label: `📞 โทร ${c}` }
  const url = safeHttpUrl(c)
  return url ? { href: url, label: '🔗 ติดต่อ' } : { href: '', label: `☎ ${c}` }
}

/** Days left until `validTo`, next to the offer. */
function dueLabel(validTo: Date | null) {
  if (!validTo) return ''
  const today = new Date()
  const end = new Date(validTo.getTime())
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const days = Math.round((end.getTime() - today.getTime()) / 864e5)
  return days < 0 ? 'สิ้นสุดแล้ว' : days === 0 ? 'สิ้นสุดวันนี้' : days === 1 ? 'สิ้นสุดพรุ่งนี้' : `เหลืออีก ${days} วัน`
}

const columnCount = () => (window.innerWidth >= 1000 ? 3 : window.innerWidth >= 640 ? 2 : 1)

/** Full-screen page for a promo ad: title, contacts, a photo wall with zoom and slideshow, offer and details. */
export function PromoDisplay({ ad, simulated, onClose, onStartPromo }: PromoDisplayProps) {
  const d = { ...emptyPromoDetails(), ...ad.details }
  const brand = ad.brand
  const images = (ad.images?.length ? ad.images : ad.image ? [ad.image] : []).map(safeImageUrl).filter(Boolean)
  const lines = (ad.tagline || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  const goal = lines[0] || ''
  const contact = contactInfo(ad.contact)
  const link = safeHttpUrl(ad.link)
  const offer = d.offer || goal.match(/ซื้อ\s*\d+\s*แถม\s*\d+|(?:ลด(?:ราคา)?|ส่วนลด)\s*\d+\s*%|ปรึกษาฟรี|ส่งฟรี|ทดลอง(?:เรียน|ใช้)?ฟรี/)?.[0] || ''
  const validFrom = parseDay(d.validFrom, false)
  const validTo = parseDay(d.validTo, true)
  const due = dueLabel(validTo)
  const mapUrl = safeHttpUrl(d.mapUrl) || (d.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}` : '')
  const lineLink = safeHttpUrl(d.line) || (d.line ? lineUrl(d.line) : '')
  const links = d.links.filter((k) => safeHttpUrl(k.url))

  const contacts = [
    contact?.href && { label: contact.label, href: contact.href },
    lineLink && { label: '💬 LINE', href: lineLink },
    ...links.map((k) => ({ label: `🔗 ${k.label || 'ลิงก์'}`, href: k.url })),
    mapUrl && { label: '📍 แผนที่', href: mapUrl },
  ].filter(Boolean) as { label: string; href: string }[]
  // The main button: the promoter's link first, then LINE, phone or e-mail, then the map.
  const ctaHref = link || lineLink || contact?.href || mapUrl
  const ctaLabel = d.ctaLabel || (link ? 'ไปที่ลิงก์' : lineLink ? 'แชทผ่าน LINE' : contact?.href.startsWith('tel:') ? 'โทรเลย' : contact?.href.startsWith('mailto:') ? 'ส่งอีเมล' : 'นำทาง')

  const details: string[] = [
    d.role && `💼 ${d.role}`,
    ...lines.slice(1),
    ...d.points.map((p) => `✓ ${p}`),
    d.hours && `🕒 ${d.hours}`,
    d.area && `🗺️ ${d.area}`,
  ].filter(Boolean) as string[]
  const terms = [...d.terms]
  if (validFrom || validTo) terms.unshift(`ระยะเวลา: ${validFrom ? dayLabel(validFrom) : 'เริ่มทันที'}${validTo ? ` – ${dayLabel(validTo)}` : ''}`)
  if (terms.length) terms.push('ผู้โปรโมทขอสงวนสิทธิ์ในการเปลี่ยนแปลงรายละเอียดโดยไม่ต้องแจ้งล่วงหน้า')
  const hasOffer = !!(offer || d.offerNote || d.price || d.oldPrice || due)

  const rootRef = useRef<HTMLDivElement>(null)
  const [viewer, setViewer] = useState<{ index: number; slideshow: boolean } | null>(null)
  const [shareText, setShareText] = useState('แชร์')
  const [columns, setColumns] = useState(columnCount)
  const [broken, setBroken] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
    const onResize = () => setColumns(columnCount())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    if (viewer) return
    // Capture phase, so Escape closes only this page and not a dialog underneath (the photo viewer handles its own).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [viewer, onClose])

  const share = async () => {
    const flash = (message: string) => {
      setShareText(message)
      setTimeout(() => setShareText('แชร์'), 1800)
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: brand, text: [brand, offer || goal].filter(Boolean).join(' · '), ...(link ? { url: link } : {}) })
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
      }
    }
    flash((await copyToClipboard(link || brand)) ? 'คัดลอกลิงก์แล้ว ✓' : 'คัดลอกไม่ได้')
  }

  const shown = images.map((src, i) => ({ src, i })).filter(({ i }) => !broken.has(i))
  const cols = Array.from({ length: columns }, (_, c) => shown.filter((_, k) => k % columns === c))
  const external = (href: string) => (/^https?:/.test(href) ? { target: '_blank', rel: 'noopener noreferrer nofollow sponsored' } : {})

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal
      aria-label={`หน้าแสดงผลโปรโมท ${brand}`}
      tabIndex={-1}
      className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain outline-none bg-(--promo-page-bg) text-(--promo-page-text) font-(family-name:--promo-page-font) leading-normal theme-scope-promo"
    >
      <div className="sticky top-0 z-[4] flex items-center justify-between gap-2 px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 bg-(--promo-page-bg)/90 backdrop-blur">
        <span className={`px-3 py-1 rounded-full border ${line} text-xs font-semibold text-(--promo-page-highlight)`}>{simulated ? 'โฆษณา · ตัวอย่าง' : 'โฆษณา'}</span>
        <span className="flex gap-2">
          <button type="button" onClick={share} className={`${chip} !py-2 ${focus}`}>
            {shareText}
          </button>
          <button type="button" onClick={onClose} aria-label="ปิด" className={`${chip} !py-2 ${focus}`}>
            ✕
          </button>
        </span>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 pt-2 pb-12">
        <div className="text-(--promo-page-highlight) font-medium tracking-[.04em]">500 WINDOWS THAILAND</div>
        <h1 className="text-[clamp(28px,5vw,48px)] leading-[1.15] font-bold mt-2 mb-3 break-words">{brand}</h1>
        {goal && <p className="text-[clamp(16px,2.2vw,20px)] text-(--promo-page-muted) mt-0 mb-4 max-w-[760px] break-words">{goal}</p>}

        {contacts.length > 0 && (
          <div className={`flex flex-wrap gap-2.5 items-center bg-(--promo-page-media-bg) border ${line} rounded-2xl px-[18px] py-3.5 mb-5 text-[18px]`}>
            <b>ติดต่อ</b>
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => (
                <a key={c.label + c.href} href={c.href} {...external(c.href)} className={`${chip} ${focus}`}>
                  {c.label}
                </a>
              ))}
            </div>
          </div>
        )}
        {contact && !contact.href && <p className="text-(--promo-page-muted) -mt-2 mb-4">{contact.label}</p>}

        {shown.length > 0 && (
          <div className="flex flex-wrap gap-2.5 items-center my-4">
            <button type="button" onClick={() => setViewer({ index: shown[0].i, slideshow: true })} className={`${chip} ${accentBtn} ${focus}`}>
              ▶ ดูสไลด์
            </button>
          </div>
        )}

        {shown.length > 0 ? (
          <div className="flex gap-3.5 items-start">
            {cols.map((col, c) => (
              <div key={c} className="flex-1 min-w-0">
                {col.map(({ src, i }) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setViewer({ index: i, slideshow: false })}
                    aria-label={`ดูรูปที่ ${i + 1}`}
                    className={`group relative block w-full mb-3.5 p-0 border-0 rounded-2xl overflow-hidden bg-(--promo-page-media-bg) cursor-zoom-in ${focus}`}
                  >
                    <img
                      src={src}
                      alt={`${brand} รูปที่ ${i + 1}`}
                      loading={i ? 'lazy' : 'eager'}
                      decoding="async"
                      onError={() => setBroken((b) => new Set(b).add(i))}
                      className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <span className="absolute right-2.5 top-2.5 bg-black/55 text-white rounded-full text-xs px-2.5 py-0.5">ซูมได้</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-(--promo-page-muted) text-[13px] text-center mt-7">ยังไม่มีรูปภาพ</p>
        )}

        {(details.length > 0 || hasOffer || d.address || ctaHref || terms.length > 0) && (
          <section className="max-w-[760px] mx-auto mt-3">
            {details.map((t, i) => (
              <p key={i} className="m-0 mb-3 break-words whitespace-pre-line">
                {t}
              </p>
            ))}
            {hasOffer && (
              <div className="bg-(--promo-page-highlight) text-[#1a1200] font-bold rounded-2xl px-[18px] py-3.5 my-4 flex flex-wrap items-center justify-between gap-x-3.5 gap-y-1.5">
                <div className="min-w-0">
                  {offer && <span className="block text-[22px] leading-tight break-words">{offer}</span>}
                  {d.offerNote && <span className="block text-sm font-semibold">{d.offerNote}</span>}
                  {(d.price || d.oldPrice) && (
                    <span className="block text-sm">
                      {d.oldPrice && <s className="opacity-70 mr-2">{d.oldPrice}</s>}
                      {d.price && <span className="text-lg font-extrabold">{d.price}</span>}
                    </span>
                  )}
                </div>
                {due && <span className="px-3 py-1 rounded-full bg-black/15 text-[13px] whitespace-nowrap">{due}</span>}
              </div>
            )}
            {d.address && <p className="text-(--promo-page-muted) my-2.5 break-words">📍 {d.address}</p>}
            {ctaHref && (
              <a href={ctaHref} {...external(ctaHref)} className={`${chip} ${accentBtn} !text-[18px] !px-7 !py-3.5 mt-1 ${focus}`}>
                {ctaLabel}
              </a>
            )}
            {terms.length > 0 && (
              <details className={`mt-5 rounded-[14px] border ${line} bg-(--promo-page-media-bg)`}>
                <summary className={`min-h-11 flex items-center px-3.5 py-2 text-sm font-bold cursor-pointer ${focus}`}>{d.termsTitle || 'เงื่อนไขและรายละเอียดเพิ่มเติม'}</summary>
                <ul className="m-0 pl-[34px] pr-3.5 pb-3 text-(--promo-page-muted) text-[13px] leading-[1.75] list-disc">
                  {terms.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {simulated && (
          <p className="max-w-[760px] mx-auto mt-5 px-3 py-2.5 rounded-xl border border-dashed border-(--promo-page-highlight) text-(--promo-page-highlight) text-[13px]">ตัวอย่างหน้าแสดงผลจากคำขอโปรโมท ยังไม่ใช่โฆษณาจริง</p>
        )}
        <div className="flex flex-col items-center gap-0.5 mt-7 text-center text-(--promo-page-muted) text-[13px]">
          <span>เนื้อหาโฆษณาเป็นความรับผิดชอบของผู้โปรโมท</span>
          {onStartPromo && !simulated && (
            <button type="button" onClick={onStartPromo} className={`min-h-11 px-3 py-2 text-(--promo-page-highlight) text-[13px] font-bold underline underline-offset-[3px] cursor-pointer ${focus}`}>
              อยากโปรโมทแบรนด์ของคุณ? เริ่มโปรโมท ›
            </button>
          )}
        </div>
      </div>

      {viewer && (
        <Lightbox
          images={shown.map((s) => s.src)}
          index={Math.max(0, shown.findIndex((s) => s.i === viewer.index))}
          onIndex={(k) => setViewer({ ...viewer, index: shown[k].i })}
          onClose={() => setViewer(null)}
          slideshow={viewer.slideshow}
        />
      )}
    </div>
  )
}
