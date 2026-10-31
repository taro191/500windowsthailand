import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    /** Life Space keeps its data in localStorage under this key (one per account). */
    VML_KEY?: string
  }
}

/**
 * Life Space (Vote my life): the original page from the KAP-TH-009 package
 * (public/kap/life-space.html), full screen over the window page. Its data stays in the
 * browser; its back button and Escape ask this page to close it.
 */
export function LifeSpace({ userId, onClose }: { userId?: string; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  // Read by the page when it loads, so people sharing a device keep separate data.
  window.VML_KEY = userId ? `vml:${userId}` : undefined

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data === 'kap-ls-close' && e.source === frame.current?.contentWindow) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('message', onMessage)
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label="Life Space" className="fixed inset-0 z-[80] bg-[#070d1a]">
      <iframe
        ref={frame}
        title="Life Space"
        src="/kap/life-space.html"
        onLoad={() => frame.current?.contentWindow?.focus()}
        className="block w-full h-full border-0 bg-transparent"
      />
    </div>
  )
}
