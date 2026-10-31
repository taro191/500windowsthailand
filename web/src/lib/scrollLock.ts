// Keeps the page behind an overlay (window page, dialogs, lightbox) from moving. iOS Safari
// ignores `overflow: hidden` on <body> and scrolls the whole document when the keyboard
// opens, so the body is pinned in place instead and the scroll position restored afterwards.
// <html data-overlay> is also set, which hides the mobile bottom bar (see BottomNav).

let locks = 0
let savedY = 0

export function lockScroll() {
  if (locks++ > 0) return
  savedY = window.scrollY
  const { style } = document.body
  style.position = 'fixed'
  style.top = `-${savedY}px`
  style.left = '0'
  style.right = '0'
  // Clipped at the screen's bottom edge, so nothing of the page shows if iOS pans the view.
  style.bottom = '0'
  style.overflow = 'hidden'
  document.documentElement.dataset.overlay = ''
}

export function unlockScroll() {
  if (locks === 0 || --locks > 0) return
  const { style } = document.body
  style.position = ''
  style.top = ''
  style.left = ''
  style.right = ''
  style.bottom = ''
  style.overflow = ''
  delete document.documentElement.dataset.overlay
  window.scrollTo(0, savedY)
}

const isTextField = (el: EventTarget | null): el is HTMLElement =>
  el instanceof HTMLElement && (el.isContentEditable || el.matches('textarea, select, input:not([type=checkbox], [type=radio], [type=range], [type=file], [type=button], [type=submit], [type=color])'))

/**
 * On touch screens: marks <html data-typing> while a text field has focus (the bottom bar
 * hides so it can't float over the keyboard) and brings the field to the middle of the space
 * left above the keyboard once the keyboard is up.
 */
export function watchTyping() {
  if (!window.matchMedia('(pointer: coarse)').matches) return
  let timer: ReturnType<typeof setTimeout> | undefined
  document.addEventListener('focusin', (e) => {
    if (!isTextField(e.target)) return
    const field = e.target
    document.documentElement.dataset.typing = ''
    clearTimeout(timer)
    // The keyboard takes a moment to open and resize the visual viewport.
    timer = setTimeout(() => field.isConnected && document.activeElement === field && field.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350)
  })
  document.addEventListener('focusout', () => {
    // Moving straight to another field keeps the flag.
    setTimeout(() => {
      if (!isTextField(document.activeElement)) delete document.documentElement.dataset.typing
    }, 50)
  })
}

/**
 * Locks page scroll whenever a full-screen overlay (a `fixed inset-0` layer at z-index 50 or
 * more: window page, dialogs, lightbox, Life Space) is on screen, so no dialog has to do it.
 */
export function watchOverlays() {
  let locked = false
  let frame = 0
  const check = () => {
    frame = 0
    const open = [...document.querySelectorAll<HTMLElement>('.fixed.inset-0')].some((el) => el.getClientRects().length > 0 && Number(getComputedStyle(el).zIndex) >= 50)
    if (open === locked) return
    locked = open
    if (open) lockScroll()
    else unlockScroll()
  }
  new MutationObserver(() => {
    frame ||= requestAnimationFrame(check)
  }).observe(document.body, { childList: true, subtree: true })
  check()
}
