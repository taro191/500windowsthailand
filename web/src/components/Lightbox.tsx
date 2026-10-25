import { useCallback, useEffect, useRef, useState } from 'react'

export interface LightboxCaption {
  title?: string
  sub?: string
  detail?: string
}

interface LightboxProps {
  images: string[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
  /** Shown under the photo; the viewer scrolls up to read a long one. */
  caption?: LightboxCaption | null
  /** Per-photo captions (promo page), used when `caption` is not given. */
  captions?: string[]
  /** Moves to the next photo every few seconds until the viewer zooms, swipes or closes. */
  slideshow?: boolean
}

const MAX_ZOOM = 6
const SLIDE_MS = 3500
const btn = 'border-0 bg-white/15 hover:bg-white/25 text-white rounded-full min-w-[42px] h-[42px] px-3.5 text-lg cursor-pointer'

/** Full-screen photo viewer: arrows / swipe between photos, zoom with buttons, wheel, pinch or double tap. */
export function Lightbox({ images, index, onIndex, onClose, caption, captions, slideshow }: LightboxProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const zoom = useRef({ s: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ startX: 0, startY: 0, moved: false, pinched: false, d0: 0, s0: 1, lastTap: 0 })
  const [reading, setReading] = useState(false)
  const [playing, setPlaying] = useState(!!slideshow)
  const count = images.length
  const at = Math.min(Math.max(index, 0), Math.max(count - 1, 0))
  const text = caption ?? (captions?.[at] ? { title: captions[at] } : null)
  const hasCaption = !!(text && (text.title || text.sub || text.detail)) || (!!caption && count > 1)

  const apply = useCallback(() => {
    const view = viewRef.current
    const img = imgRef.current
    if (!view || !img) return
    const z = zoom.current
    const mx = Math.max(0, (img.offsetWidth * z.s - view.clientWidth) / 2)
    const my = Math.max(0, (img.offsetHeight * z.s - view.clientHeight) / 2)
    z.x = Math.max(-mx, Math.min(mx, z.x))
    z.y = Math.max(-my, Math.min(my, z.y))
    img.style.transform = `translate(${z.x}px,${z.y}px) scale(${z.s})`
  }, [])
  const reset = useCallback(() => {
    zoom.current = { s: 1, x: 0, y: 0 }
    apply()
  }, [apply])
  const zoomBy = useCallback(
    (f: number) => {
      const z = zoom.current
      z.s = Math.max(1, Math.min(MAX_ZOOM, z.s * f))
      if (z.s === 1) z.x = z.y = 0
      setPlaying(false)
      apply()
    },
    [apply],
  )
  const go = useCallback(
    (step: number) => {
      if (count < 2) return
      onIndex((at + step + count) % count)
    },
    [at, count, onIndex],
  )

  useEffect(reset, [at, reset])
  useEffect(() => {
    if (count > 1) new Image().src = images[(at + 1) % count]
  }, [at, count, images])

  useEffect(() => {
    if (!playing || count < 2) return
    const timer = setInterval(() => zoom.current.s === 1 && go(1), SLIDE_MS)
    return () => clearInterval(timer)
  }, [playing, count, go])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    // Capture phase, so keys act on the viewer only and not on the page underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === '+' || e.key === '=') zoomBy(1.5)
      else if (e.key === '-') zoomBy(1 / 1.5)
      else if (e.key === '0') reset()
      else if (e.key === 'Tab') {
        const nodes = [...(rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])].filter((n) => n.getClientRects().length)
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (!first) return
        const active = document.activeElement
        if (!rootRef.current?.contains(active)) first.focus()
        else if (e.shiftKey && active === first) last.focus()
        else if (!e.shiftKey && active === last) first.focus()
        else return
      } else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go, onClose, reset, zoomBy])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15)
    }
    view.addEventListener('wheel', onWheel, { passive: false })
    return () => view.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  const distance = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const g = gesture.current
    if (!pointers.current.size) Object.assign(g, { startX: e.clientX, startY: e.clientY, moved: false, pinched: false })
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) Object.assign(g, { pinched: true, d0: distance(), s0: zoom.current.s })
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const last = pointers.current.get(e.pointerId)
    if (!last) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const z = zoom.current
    if (pointers.current.size === 2) {
      if (g.d0 > 0) {
        z.s = Math.max(1, Math.min(MAX_ZOOM, (g.s0 * distance()) / g.d0))
        apply()
      }
    } else if (z.s > 1) {
      z.x += e.clientX - last.x
      z.y += e.clientY - last.y
      apply()
    }
    if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 6) g.moved = true
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size) return
    const g = gesture.current
    const dx = e.clientX - g.startX
    if (e.type === 'pointerup' && !g.moved && !g.pinched) {
      const now = Date.now()
      if (now - g.lastTap < 320) {
        g.lastTap = 0
        if (zoom.current.s > 1) reset()
        else zoomBy(2.5)
      } else g.lastTap = now
      return
    }
    if (zoom.current.s === 1 && !g.pinched && g.moved && Math.abs(dx) > 60) {
      setPlaying(false)
      go(dx < 0 ? 1 : -1)
    }
  }

  if (!count) return null
  const sub = [text?.sub, caption && count > 1 ? `รูป ${at + 1}/${count}` : ''].filter(Boolean).join(' · ')

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal
      aria-label="ดูภาพขยาย"
      onScroll={(e) => setReading(e.currentTarget.scrollTop > 40)}
      className="fixed inset-0 z-[90] bg-black overflow-y-auto overscroll-contain select-none font-[Prompt,sans-serif] text-white"
    >
      <div className="fixed top-0 inset-x-0 z-[2] flex justify-between items-center gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button ref={closeRef} type="button" onClick={onClose} aria-label="ปิด" className={btn}>
          ✕
        </button>
        {!reading && (
          <span className="flex items-center gap-2">
            {!caption && count > 1 && <span className="text-sm mr-1">{at + 1} / {count}</span>}
            {slideshow && count > 1 && (
              <button type="button" onClick={() => setPlaying(!playing)} className={`${btn} text-sm`}>
                {playing ? '⏸ หยุด' : '▶ สไลด์'}
              </button>
            )}
            <button type="button" onClick={() => zoomBy(1 / 1.5)} aria-label="ซูมออก" className={btn}>
              −
            </button>
            <button type="button" onClick={() => zoomBy(1.5)} aria-label="ซูมเข้า" className={btn}>
              ＋
            </button>
            <button type="button" onClick={reset} aria-label="รีเซ็ตการซูม" className={`${btn} text-sm`}>
              รีเซ็ต
            </button>
          </span>
        )}
      </div>
      {count > 1 && !reading && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="ภาพก่อนหน้า" className={`${btn} fixed z-[2] left-2.5 ${hasCaption ? 'top-[calc(50%-36px)]' : 'top-1/2'} -translate-y-1/2`}>
            ‹
          </button>
          <button type="button" onClick={() => go(1)} aria-label="ภาพถัดไป" className={`${btn} fixed z-[2] right-2.5 ${hasCaption ? 'top-[calc(50%-36px)]' : 'top-1/2'} -translate-y-1/2`}>
            ›
          </button>
        </>
      )}
      <div
        ref={viewRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative flex items-center justify-center overflow-hidden touch-none ${hasCaption ? 'h-[calc(100dvh-72px)]' : 'h-dvh'}`}
      >
        <img ref={imgRef} src={images[at]} alt={text?.title || `ภาพที่ ${at + 1}`} draggable={false} className="max-w-full max-h-full origin-center will-change-transform cursor-grab" />
      </div>
      {hasCaption && (
        <div
          onClick={(e) => e.currentTarget.parentElement && e.currentTarget.parentElement.scrollTop < 40 && e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="relative z-[3] min-h-[60vh] px-4 pt-3.5 pb-[calc(24px+env(safe-area-inset-bottom))] bg-[#0d1a2e] border-t border-[#27406b] text-[#e8eefc] select-text"
        >
          {!reading && <span className="block text-center text-xs text-[#93a4c4] -mt-1.5 mb-1.5 cursor-pointer">▲ ปัดขึ้นเพื่ออ่านรายละเอียด</span>}
          {text?.title && <b>{text.title}</b>} {sub && <small className="text-[#3fb8b0]">{sub}</small>}
          {text?.detail && <p className="text-[#93a4c4] mt-1 text-sm leading-relaxed whitespace-pre-line">{text.detail}</p>}
        </div>
      )}
    </div>
  )
}
