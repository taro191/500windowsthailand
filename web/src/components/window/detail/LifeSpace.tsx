import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { openLifeSpaceStorage, type LifeSpaceStorage } from '../../../lib/lifeSpace'

declare global {
  interface Window {
    /** Life Space keeps its data in localStorage under this key (one per account). */
    VML_KEY?: string
    /** Server storage, used by the page once the user consents. */
    VML_STORAGE?: LifeSpaceStorage
  }
}

/**
 * Life Space (Vote my life): the original page from the KAP-TH-009 package
 * (public/kap/life-space.html), full screen over the window page. Its data stays in the
 * browser unless a signed-in user consents to keep it on the server ("บันทึกประจำวัน");
 * its back button and Escape ask this page to close it.
 */
export function LifeSpace({ userId, onClose }: { userId?: string; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  // The page reads its storage once when it loads, so wait for the server copy first.
  const [ready, setReady] = useState(!userId)
  // Read by the page when it loads, so people sharing a device keep separate data.
  window.VML_KEY = userId ? `vml:${userId}` : undefined

  useEffect(() => {
    if (!userId) return
    let live = true
    let storage: LifeSpaceStorage | null = null
    void openLifeSpaceStorage().then((s) => {
      if (!live) return
      storage = s
      // Offline: the page still works, keeping data on this device only.
      window.VML_STORAGE = s ?? undefined
      setReady(true)
    })
    return () => {
      live = false
      storage?.settle()
      window.VML_STORAGE = undefined
    }
  }, [userId])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data === 'kap-ls-close' && e.source === frame.current?.contentWindow) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('message', onMessage)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label="Life Space" className="fixed inset-0 z-[80] bg-[#070d1a]">
      {ready ? (
        <iframe
          ref={frame}
          title="Life Space"
          src="/kap/life-space.html"
          onLoad={() => frame.current?.contentWindow?.focus()}
          className="block w-full h-full border-0 bg-transparent"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-white/70">
          <Loader2 className="w-8 h-8 animate-spin" aria-label="กำลังโหลด..." />
        </div>
      )}
    </div>
  )
}
