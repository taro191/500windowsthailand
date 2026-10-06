import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea, select, a[href], summary, [tabindex="0"]'

/**
 * Modal dialog behaviour while `isOpen`: focus the dialog, keep Tab inside it, close on
 * Escape, lock page scroll, and restore focus to the previous element on close.
 */
export function useDialogFocus(isOpen: boolean, dialogRef: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => dialogRef.current?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const nodes = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) => node.getClientRects().length,
      )
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (!first) {
        event.preventDefault()
        return
      }
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || active === dialogRef.current)) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [isOpen, dialogRef, onClose])
}
