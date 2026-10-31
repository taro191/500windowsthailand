// Co Center: the original embed script (public/kap/co-center-embed.js, from the KAP-TH-009
// package) draws the tab; this loads it once and feeds it /api/co-center.
import { get } from './api'

interface CoCenterEmbed {
  init(options: { onchange?: () => void }): void
  /** Whether there is any window to show. */
  has(): boolean
  /** The tab's root element (built once). */
  node(): HTMLElement
  show(visible: boolean): void
}

declare global {
  interface Window {
    KAP_CO_EMBED?: CoCenterEmbed
    KAP_CO_ADAPTER?: { load: () => Promise<unknown> }
  }
}

const listeners = new Set<() => void>()
let ready: Promise<CoCenterEmbed | null> | null = null

/** The embed, loaded and started on first use; null if the script could not load. */
export function loadCoCenter(): Promise<CoCenterEmbed | null> {
  ready ??= new Promise((resolve) => {
    window.KAP_CO_ADAPTER = { load: async () => {
      const result = await get<{ serverTime: string; windows: unknown[] }>('/co-center')
      return result.success ? result : []
    } }
    const script = document.createElement('script')
    script.src = '/kap/co-center-embed.js'
    script.onload = () => {
      const embed = window.KAP_CO_EMBED
      if (!embed) return resolve(null)
      embed.init({ onchange: () => listeners.forEach((fn) => fn()) })
      resolve(embed)
    }
    script.onerror = () => {
      ready = null
      resolve(null)
    }
    document.head.appendChild(script)
  })
  return ready
}

/** Called when Co Center gets or loses windows to show. */
export function onCoCenterChange(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
