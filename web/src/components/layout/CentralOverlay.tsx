import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * The central page (public/kap/central.html) full screen over the board, so closing it returns to
 * where the user was. Links back into the app arrive from public/kap/embed-nav.js as messages:
 * "/" just closes, a window link closes and opens that window.
 */
export function CentralOverlay({ onClose }: { onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      // Life Space opened from here asks to close itself: step back to the central page.
      if (e.data === 'kap-ls-close') return frame.current?.contentWindow?.history.back()
      const msg = e.data as { kap?: string; action?: string; url?: string }
      if (msg?.kap !== 'embed') return
      onClose()
      if (msg.action !== 'open' || !msg.url) return
      const win = msg.url.match(/^\/w\/([a-z]+)\/(\d+)\/?$/)
      if (win) window.location.hash = `window-${win[1]}-${win[2]}`
      else if (msg.url.startsWith('/#')) window.location.hash = msg.url.slice(2)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('message', onMessage)
    window.addEventListener('keydown', onKey)
    // The board stays where it was underneath.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label="ส่วนกลาง" className="fixed inset-0 z-[60] bg-[#f4f1ea]">
      <iframe
        ref={frame}
        title="ส่วนกลาง"
        src="/kap/central.html"
        onLoad={() => frame.current?.contentWindow?.focus()}
        className="block w-full h-full border-0 bg-transparent"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิด"
        className="absolute top-[max(10px,env(safe-area-inset-top))] right-[max(10px,env(safe-area-inset-right))] w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer shadow-lg"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
