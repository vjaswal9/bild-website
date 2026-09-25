// Fire `onEnter` once when `el` is in (or near) the viewport.
// Deliberately defensive so content is NEVER left hidden:
//  - reveals immediately if already in view on mount (handles above-the-fold),
//  - uses IntersectionObserver when available,
//  - also listens to scroll + visibilitychange as a fallback,
//  - and a final safety timeout guarantees the reveal even if nothing else fires.
export function onEnterView(el: Element, onEnter: () => void): () => void {
  let done = false

  const inViewport = () => {
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight
    return r.top < vh * 0.92 && r.bottom > 0
  }

  const fire = () => {
    if (done) return
    done = true
    cleanup()
    onEnter()
  }

  // Already visible (e.g. above the fold): reveal right away.
  if (inViewport()) {
    onEnter()
    done = true
    return () => {}
  }

  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          entries => { if (entries.some(e => e.isIntersecting)) fire() },
          { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
        )
      : null
  io?.observe(el)

  const check = () => { if (inViewport()) fire() }
  window.addEventListener('scroll', check, { passive: true })
  window.addEventListener('resize', check, { passive: true })
  document.addEventListener('visibilitychange', check)
  // Catch-all: never leave content hidden, even if no trigger fires.
  const safety = window.setTimeout(fire, 4000)

  function cleanup() {
    io?.disconnect()
    window.removeEventListener('scroll', check)
    window.removeEventListener('resize', check)
    document.removeEventListener('visibilitychange', check)
    window.clearTimeout(safety)
  }

  return cleanup
}
