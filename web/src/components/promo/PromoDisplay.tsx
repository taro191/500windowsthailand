import { useEffect, useRef, useState } from 'react'
import { lineUrl } from '@shared/windowProfile'
import { copyToClipboard } from '@/lib/browser'
import { emptyPromoDetails, safeHttpUrl, safeImageUrl, type PromoAd } from '@/lib/promo'

interface PromoDisplayProps {
  ad: PromoAd
  /** Preview of a request that isn't live yet (request dialog, admin review). */
  simulated?: boolean
  onClose: () => void
  /** "Promote your brand" link at the bottom (live ads only). */
  onStartPromo?: () => void
}

const accent = 'bg-gradient-to-r from-[#ea580c] to-[#c026d3]'
const deep = 'bg-gradient-to-r from-[#c2410c] to-[#a21caf]'
const glass = 'bg-[rgba(10,8,20,.58)] backdrop-blur-md'
const chipBox = 'border border-white/15 bg-white/[.06]'
const focus = 'focus-visible:outline-3 focus-visible:outline-[#fbbf24] focus-visible:outline-offset-2'

/** Up to two letters of the brand, skipping Thai leading vowels and keeping marks with their consonant. */
function initials(brand: string) {
  const m = brand.replace(/[เแโใไ]/g, '').match(/[^\sัิ-ฺ็-๎][ัิ-ฺ็-๎]*/gu)
  return m ? m.slice(0, 2).join('') : 'AD'
}

const parseDay = (s: string, end: boolean) => {
  if (!s) return null
  const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}${end ? 'T23:59:59' : 'T00:00:00'}` : s)
  return Number.isNaN(t.getTime()) ? null : t
}
const dayLabel = (t: Date) => t.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

function contactInfo(raw = '') {
  const c = raw.trim()
  if (!c) return null
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return { href: `mailto:${c}`, icon: '✉' }
  const digits = c.replace(/[\s-]/g, '')
  if (/^\+?\d{8,15}$/.test(digits)) return { href: `tel:${digits}`, icon: '☎' }
  return { href: safeHttpUrl(c), icon: safeHttpUrl(c) ? '↗' : '☎' }
}

/** Days left until `validTo`, as the badge on the offer card. */
function dueLabel(validTo: Date | null) {
  if (!validTo) return ''
  const today = new Date()
  const end = new Date(validTo.getTime())
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const days = Math.round((end.getTime() - today.getTime()) / 864e5)
  return days < 0 ? 'สิ้นสุดแล้ว' : days === 0 ? 'สิ้นสุดวันนี้' : days === 1 ? 'สิ้นสุดพรุ่งนี้' : `เหลืออีก ${days} วัน`
}

/** Full-screen page for a promo ad: photos, offer, practical details, terms and action buttons. */
export function PromoDisplay({ ad, simulated, onClose, onStartPromo }: PromoDisplayProps) {
  const d = { ...emptyPromoDetails(), ...ad.details }
  const brand = ad.brand
  const images = (ad.images?.length ? ad.images : ad.image ? [ad.image] : []).map(safeImageUrl).filter(Boolean)
  const lines = (ad.tagline || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  const hook = lines[0] || ''
  const extraLines = [...lines.slice(1, 5), ...d.points].slice(0, 6)
  const contact = contactInfo(ad.contact)
  const link = safeHttpUrl(ad.link)
  const offer = d.offer || hook.match(/ซื้อ\s*\d+\s*แถม\s*\d+|(?:ลด(?:ราคา)?|ส่วนลด)\s*\d+\s*%|ปรึกษาฟรี|ส่งฟรี|ทดลอง(?:เรียน|ใช้)?ฟรี/)?.[0] || ''
  const validFrom = parseDay(d.validFrom, false)
  const validTo = parseDay(d.validTo, true)
  const due = dueLabel(validTo)

  const mapUrl = safeHttpUrl(d.mapUrl) || (d.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}` : '')
  const line = safeHttpUrl(d.line) || (d.line ? lineUrl(d.line) : '')
  const links = d.links.filter((k) => safeHttpUrl(k.url))
  // The button built from what the promoter filled in: LINE > map > first link > email.
  type Sys = { href: string; label: string; used: 'line' | 'map' | 'link0' | 'mail' }
  let sys: Sys | null = line
    ? { href: line, label: '💬 แชทผ่าน LINE', used: 'line' }
    : mapUrl
      ? { href: mapUrl, label: '📍 นำทาง', used: 'map' }
      : links[0]
        ? { href: links[0].url, label: `🔗 ${links[0].label || 'ลิงก์'}`, used: 'link0' }
        : contact?.href.startsWith('mailto:')
          ? { href: contact.href, label: '✉ อีเมล', used: 'mail' }
          : null
  if (sys && d.ctaLabel) sys = { ...sys, label: d.ctaLabel }
  const chips = [
    mapUrl && sys?.used !== 'map' && { label: '📍 นำทาง', href: mapUrl },
    line && sys?.used !== 'line' && { label: '💬 LINE', href: line },
    ...links.filter((_, i) => !(sys?.used === 'link0' && i === 0)).map((k) => ({ label: `🔗 ${k.label || 'ลิงก์'}`, href: k.url })),
  ].filter(Boolean) as { label: string; href: string }[]

  const info: [string, string][] = []
  if (contact) info.push([contact.icon, `ติดต่อ: ${ad.contact}`])
  if (d.hours) info.push(['🕒', d.hours])
  if (d.address) info.push(['📍', d.address])
  if (d.area) info.push(['📍', d.area])
  for (const t of extraLines) info.push([/\d{1,2}[:.]\d{2}|เปิด|ปิด/.test(t) ? '🕒' : '✓', t])

  const terms = [...d.terms]
  if (validFrom || validTo) terms.unshift(`ระยะเวลา: ${validFrom ? dayLabel(validFrom) : 'เริ่มทันที'}${validTo ? ` – ${dayLabel(validTo)}` : ''}`)
  if (terms.length) terms.push('ผู้โปรโมทขอสงวนสิทธิ์ในการเปลี่ยนแปลงรายละเอียดโดยไม่ต้องแจ้งล่วงหน้า')

  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [shareText, setShareText] = useState('แชร์')
  const count = Math.max(1, images.length)
  const go = (i: number) => {
    const track = trackRef.current
    if (track && count > 1) track.scrollLeft = Math.max(0, Math.min(count - 1, i)) * track.clientWidth
  }

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
    // Capture phase, so Escape closes only this page and not a dialog underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      } else if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const share = async () => {
    const flash = (message: string) => {
      setShareText(message)
      setTimeout(() => setShareText('แชร์'), 1800)
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: brand, text: [brand, offer || hook].filter(Boolean).join(' · '), ...(link ? { url: link } : {}) })
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
      }
    }
    flash((await copyToClipboard(link || brand)) ? 'คัดลอกลิงก์แล้ว ✓' : 'คัดลอกไม่ได้')
  }

  const ctaButton = (main: boolean, label: string, href: string) => (
    <a
      key={label + href}
      href={href}
      target={/^https?:/.test(href) ? '_blank' : undefined}
      rel="noopener noreferrer nofollow sponsored"
      className={`flex items-center justify-center gap-2 min-w-0 min-h-[54px] px-5 rounded-2xl font-bold text-center no-underline active:scale-[.98] transition-transform ${focus} ${main ? `flex-1 text-[19px] text-white ${accent} shadow-[0_8px_24px_rgba(192,38,211,.35)]` : `flex-[1.6] text-base text-[#fafaf9] ${chipBox} border-2`}`}
    >
      <span className="min-w-0 line-clamp-2 leading-tight break-words">{label}</span>
      <b>↗</b>
    </a>
  )

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal
      aria-label={`หน้าแสดงผลโปรโมท ${brand}`}
      tabIndex={-1}
      className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain outline-none bg-[radial-gradient(120%_50%_at_50%_0%,#2a1245,#0b0814_62%)] text-[#fafaf9] font-['Prompt','Noto_Sans_Thai',sans-serif] animate-[pqIn_.25s_ease-out] motion-reduce:animate-none"
    >
      <style>{'@keyframes pqIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'}</style>
      <div className="max-w-[520px] mx-auto min-h-full flex flex-col">
        <div className="relative flex-none aspect-[4/3] bg-[#1c1530] overflow-hidden after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-[34%] after:bg-gradient-to-t after:from-[#0b0814] after:from-[6%] after:to-transparent after:pointer-events-none after:z-[1]">
          <div
            ref={trackRef}
            onScroll={(e) => {
              const t = e.currentTarget
              setIndex(Math.round(t.scrollLeft / (t.clientWidth || 1)))
            }}
            className="flex h-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.length ? (
              images.map((src, i) => <Slide key={i} src={src} alt={`${brand} รูปที่ ${i + 1}`} fallback={initials(brand)} lazy={i > 0} />)
            ) : (
              <Slide src="" alt="" fallback={initials(brand)} />
            )}
          </div>

          <div className="absolute z-[3] inset-x-0 top-0 flex items-center justify-between gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
            <button type="button" onClick={onClose} aria-label="ปิด" className={`min-w-11 h-11 px-3.5 rounded-full ${glass} text-white text-sm font-semibold cursor-pointer ${focus}`}>
              ✕
            </button>
            <span className="px-3 py-1.5 rounded-full bg-[rgba(10,8,20,.78)] backdrop-blur-md text-[#fde68a] text-xs font-bold whitespace-nowrap">
              {simulated ? 'โฆษณา · ตัวอย่าง' : 'โฆษณา'}
            </span>
            <button type="button" onClick={share} className={`min-w-11 h-11 px-3.5 rounded-full ${glass} text-white text-sm font-semibold cursor-pointer ${focus}`}>
              {shareText}
            </button>
          </div>

          {images.length > 1 && (
            <>
              <button type="button" onClick={() => go(index - 1)} aria-label="รูปก่อนหน้า" className={`hidden [@media(hover:hover)]:block absolute z-[2] top-1/2 -translate-y-1/2 left-2.5 w-10 h-10 rounded-full ${glass} text-white text-[22px] leading-none cursor-pointer ${focus}`}>
                ‹
              </button>
              <button type="button" onClick={() => go(index + 1)} aria-label="รูปถัดไป" className={`hidden [@media(hover:hover)]:block absolute z-[2] top-1/2 -translate-y-1/2 right-2.5 w-10 h-10 rounded-full ${glass} text-white text-[22px] leading-none cursor-pointer ${focus}`}>
                ›
              </button>
              <div className="absolute z-[2] inset-x-0 bottom-[18px] flex justify-center gap-1.5 pointer-events-none">
                {images.map((_, i) => (
                  <i key={i} className={`h-2 rounded-full transition-[width] ${i === index ? 'w-[22px] bg-white' : 'w-2 bg-white/55'}`} />
                ))}
              </div>
              <span className={`absolute z-[2] right-3 bottom-3.5 px-2.5 py-1 rounded-full ${glass} text-white text-xs font-semibold`}>
                {index + 1}/{count}
              </span>
            </>
          )}
        </div>

        <div className="relative z-[1] flex-none px-5 pt-1.5 pb-7">
          <h1 className="m-0 text-[32px] leading-tight font-extrabold tracking-[-.01em] break-words">{brand}</h1>
          {d.role && <p className="mt-1.5 text-[15px] leading-normal font-medium text-[#b8b2ad] break-words">{d.role}</p>}
          {hook && <p className="mt-2.5 text-[19px] leading-normal font-bold text-[#fbbf24] break-words whitespace-pre-wrap">{hook}</p>}

          {(offer || d.price || d.oldPrice || due) && (
            <div className={`mt-[18px] px-4 py-3.5 rounded-2xl ${deep} text-white flex items-center justify-between flex-wrap gap-x-3.5 gap-y-2.5 shadow-[0_8px_24px_rgba(192,38,211,.3)]`}>
              <div>
                {offer && <b className="block text-[30px] leading-tight font-extrabold break-words">{offer}</b>}
                {d.offerNote && <small className="block mt-0.5 text-sm font-semibold">{d.offerNote}</small>}
                {(d.price || d.oldPrice) && (
                  <small className="block mt-0.5 text-sm font-semibold">
                    {d.oldPrice && <s className="opacity-80 mr-2">{d.oldPrice}</s>}
                    {d.price && <em className="not-italic font-extrabold text-lg">{d.price}</em>}
                  </small>
                )}
              </div>
              {due && <span className="px-3 py-1.5 rounded-full bg-black/35 text-[13px] font-bold whitespace-nowrap">{due}</span>}
            </div>
          )}

          {info.length > 0 && (
            <ul className="list-none mt-3.5 p-0 grid gap-2.5">
              {info.map(([icon, text], i) => (
                <li key={i} className={`flex items-start gap-3 px-3.5 py-3 rounded-[14px] ${chipBox} text-[15px] leading-relaxed break-words`}>
                  <span className={`flex-none w-6 h-6 mt-px rounded-full ${deep} text-white text-xs font-extrabold leading-6 text-center`}>{icon}</span>
                  <span className="min-w-0">{text}</span>
                </li>
              ))}
            </ul>
          )}

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {chips.map((c) => (
                <a key={c.label + c.href} href={c.href} target="_blank" rel="noopener noreferrer nofollow sponsored" className={`min-h-11 inline-flex items-center px-4 rounded-full ${chipBox} text-sm font-semibold no-underline ${focus}`}>
                  {c.label}
                </a>
              ))}
            </div>
          )}

          {terms.length > 0 && (
            <details className={`mt-4 rounded-[14px] ${chipBox}`}>
              <summary className={`min-h-11 flex items-center px-3.5 py-2 text-sm font-bold cursor-pointer ${focus}`}>{d.termsTitle || 'เงื่อนไขและรายละเอียดเพิ่มเติม'}</summary>
              <ul className="m-0 pl-[34px] pr-3.5 pb-3 text-[#b8b2ad] text-[13px] leading-[1.75] list-disc">
                {terms.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </details>
          )}

          {simulated && (
            <div className="mt-[18px] px-3 py-2.5 rounded-xl border border-dashed border-[#fbbf24]/75 bg-[#fbbf24]/[.08] text-[#fbbf24] text-[13px] leading-relaxed">
              ตัวอย่างหน้าแสดงผลจากคำขอโปรโมท ยังไม่ใช่โฆษณาจริง
            </div>
          )}

          <div className="mt-7 pt-3.5 border-t border-white/15 flex flex-col items-center gap-0.5 text-center text-[#b8b2ad] text-[13px] leading-relaxed">
            <span>เนื้อหาโฆษณาเป็นความรับผิดชอบของผู้โปรโมท</span>
            {onStartPromo && !simulated && (
              <button type="button" onClick={onStartPromo} className={`min-h-11 px-3 py-2 text-[#fbbf24] text-[13px] font-bold underline underline-offset-[3px] cursor-pointer ${focus}`}>
                อยากโปรโมทแบรนด์ของคุณ? เริ่มโปรโมท ›
              </button>
            )}
          </div>
        </div>

        {(link || sys) && (
          <div className="sticky bottom-0 z-[4] mt-auto flex gap-2.5 px-4 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0b0814] from-[72%] to-transparent">
            {link && ctaButton(true, 'ไปที่ลิงก์', link)}
            {sys && ctaButton(!link, sys.label, sys.href)}
          </div>
        )}
      </div>
    </div>
  )
}

function Slide({ src, alt, fallback, lazy }: { src: string; alt: string; fallback: string; lazy?: boolean }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="flex-[0_0_100%] h-full snap-center">
      {src && !broken ? (
        <img src={src} alt={alt} decoding="async" loading={lazy ? 'lazy' : undefined} onError={() => setBroken(true)} className="block w-full h-full object-cover" />
      ) : (
        <div className={`flex items-center justify-center w-full h-full ${accent} text-[88px] font-extrabold text-white`}>{fallback}</div>
      )}
    </div>
  )
}
