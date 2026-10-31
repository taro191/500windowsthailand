import { useEffect } from 'react'

/**
 * Keeps the CSS variables --app-height and --app-top equal to the visible viewport's height
 * and offset, so full-height overlays fit above mobile browser toolbars and the on-screen
 * keyboard, and follow iOS when it pans the view to show the field being typed in.
 */
export function useViewportHeight() {
  useEffect(() => {
    const sync = () => {
      const height = window.visualViewport?.height || window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${height}px`)
      document.documentElement.style.setProperty('--app-top', `${window.visualViewport?.offsetTop || 0}px`)
    }
    sync()
    window.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('scroll', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('scroll', sync)
    }
  }, [])
}
