import { useEffect } from 'react'

/**
 * Keeps the CSS variable --app-height equal to the visible viewport height, so
 * full-height overlays fit above mobile browser toolbars and the on-screen keyboard.
 */
export function useViewportHeight() {
  useEffect(() => {
    const sync = () => {
      const height = window.visualViewport?.height || window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${height}px`)
    }
    sync()
    window.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('resize', sync)
    }
  }, [])
}
