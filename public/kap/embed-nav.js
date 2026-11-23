/* 500windowsthailand: when a /kap page runs inside the site's overlay (CentralOverlay.tsx),
   links back into the app ("/", "/#...", "/w/<region>/<num>") go to the parent page instead of
   loading the whole site inside the frame. Other site pages stay in the frame; other sites open
   in a new tab. Standalone pages are left alone. */
(function () {
  if (window.parent === window) return
  function toApp(path) {
    return path === '/' || /^\/w\/[a-z]+\/\d+\/?$/.test(path)
  }
  function send(msg) {
    window.parent.postMessage(Object.assign({ kap: 'embed' }, msg), location.origin)
  }
  /** Opens a URL the embedded way; returns false when the frame should just load it. */
  window.KAP_GO = function (href) {
    var u = new URL(href, location.href)
    if (u.origin !== location.origin) {
      window.open(u.href, '_blank', 'noopener')
      return true
    }
    if (!toApp(u.pathname)) return false
    send({ action: 'open', url: u.pathname + u.hash })
    return true
  }
  // Bubbling, so the page's own handlers (zoom buttons inside cards) can cancel first.
  document.addEventListener(
    'click',
    function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      var a = e.target.closest && e.target.closest('a[href]')
      if (!a || a.target === '_blank') return
      if (window.KAP_GO(a.href)) e.preventDefault()
    },
  )
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') send({ action: 'close' })
  })
})()
