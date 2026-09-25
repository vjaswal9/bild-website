'use client'

import { useRef, useEffect, useLayoutEffect, ReactNode } from 'react'
import { onEnterView } from './inview'

// Run layout effects on the client, plain effect on the server (avoids SSR warning).
const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type Props = {
  children: ReactNode
  className?: string
  /** distance (px) the element travels up as it fades in */
  y?: number
  /** distance (px) the element travels horizontally as it fades in (negative = from the left) */
  x?: number
  /** seconds to wait before animating */
  delay?: number
  /** if set, the element's DIRECT children are revealed one after another */
  stagger?: number
}

const DURATION_MS = 700
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

// Reveals content as it scrolls into view.
//
// This used to drive the tween with GSAP, which meant 70KB of library on
// every page that reveals anything, which is most of them, to fade and move
// two properties. A CSS transition does the same job: both opacity and
// transform are compositor properties, so this costs no layout work and
// contributes nothing to layout shift.
//
// The IntersectionObserver plumbing in ./inview.ts is unchanged. It is
// deliberately defensive, with four separate ways of firing, so that content
// can never be left stuck invisible, and that property matters far more than
// which library moves the pixels.
export default function Reveal({ children, className, y = 28, x = 0, delay = 0, stagger }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useIso(() => {
    const el = ref.current
    if (!el) return
    // Respect reduced-motion: leave everything fully visible, no animation.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const targets = (stagger != null ? Array.from(el.children) : [el]) as HTMLElement[]
    if (targets.length === 0) return

    for (const t of targets) {
      t.style.opacity = '0'
      t.style.transform = `translate3d(${x}px, ${y}px, 0)`
      t.style.willChange = 'opacity, transform'
    }

    const show = (instant: boolean) => {
      targets.forEach((t, i) => {
        const wait = instant ? 0 : (delay + i * (stagger ?? 0)) * 1000
        t.style.transition = instant
          ? 'none'
          : `opacity ${DURATION_MS}ms ${EASE} ${wait}ms, transform ${DURATION_MS}ms ${EASE} ${wait}ms`
        t.style.opacity = '1'
        t.style.transform = 'translate3d(0, 0, 0)'
      })
    }

    const cleanup = onEnterView(el, () => {
      // A hidden tab does not run transitions, and the element would be left
      // invisible until the tab is looked at again. Jump straight to the end.
      if (document.hidden) return show(true)
      // onEnterView fires synchronously when the element is already on screen,
      // in the same tick that set the starting styles above. Without reading
      // back a layout property first the browser coalesces the two and skips
      // the transition entirely, so above-the-fold content would appear with
      // no animation at all.
      void el.offsetHeight
      show(false)
    })

    return () => {
      cleanup()
      for (const t of targets) {
        t.style.removeProperty('opacity')
        t.style.removeProperty('transform')
        t.style.removeProperty('transition')
        t.style.removeProperty('will-change')
      }
    }
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
