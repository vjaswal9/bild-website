'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Renders a modal overlay into <body>, outside the page tree.
//
// Every page's content sits inside PageTransition's animate-page-in wrapper,
// whose animation is 'forwards' and ends on a transform. A finished filling
// animation keeps producing an animated value, and an animated transform
// computes to an identity matrix rather than 'none' - so the wrapper stays a
// containing block for position:fixed descendants, permanently.
//
// The effect is that a `fixed inset-0` overlay rendered inside a page sizes and
// positions itself against the full-height page wrapper instead of the
// viewport. On the photo vault that put the lightbox up to 2000px above or
// below the screen depending on scroll position; the same applied to every
// admin modal. See the warning on the pageIn keyframe in tailwind.config.ts for
// the two fixes that were tried there and why neither worked.
//
// Portalling to <body> sidesteps it entirely, and is what a modal wants anyway:
// it also keeps the overlay clear of any future ancestor transform, filter or
// z-index context.
export default function ModalPortal({
  children,
  onClose,
  lockScroll = true,
}: {
  children: React.ReactNode
  // Wired to Escape. Omit for a modal that must be dismissed deliberately.
  onClose?: () => void
  lockScroll?: boolean
}) {
  // createPortal needs a real document, which does not exist during SSR.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // The page behind a modal must not scroll. Restores whatever was there
  // before rather than assuming '', so nested or successive modals cannot
  // leave the page permanently unscrollable.
  useEffect(() => {
    if (!lockScroll) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [lockScroll])

  if (!mounted) return null
  return createPortal(children, document.body)
}
