'use client'

import { useRef, useEffect, useLayoutEffect } from 'react'
import { onEnterView } from './inview'

const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const DURATION_MS = 1600

// Animates a leading number up from 0 when it scrolls into view, preserving any
// prefix/suffix and comma formatting. Non-numeric values render unchanged.
//
// Counted with requestAnimationFrame rather than a GSAP tween. The easing
// below is the cubic ease-out that 'power2.out' resolves to, so the motion is
// unchanged; it simply no longer needs an animation library to do arithmetic.
export default function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const match = value.match(/^([\d,]+)(.*)$/)

  useIso(() => {
    const el = ref.current
    if (!el || !match) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = value
      return
    }

    const target = parseInt(match[1].replace(/,/g, ''), 10)
    const hasComma = match[1].includes(',')
    const suffix = match[2]
    const fmt = (n: number) => (hasComma ? n.toLocaleString('en-US') : String(n)) + suffix

    el.textContent = fmt(0)
    let raf = 0

    const cleanup = onEnterView(el, () => {
      // Hidden tab: no frames are delivered, so show the final value instantly
      // rather than leaving a zero on screen.
      if (document.hidden) {
        el.textContent = fmt(target)
        return
      }
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / DURATION_MS)
        const eased = 1 - Math.pow(1 - p, 3)
        el.textContent = fmt(Math.round(target * eased))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })

    return () => {
      cleanup()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // SSR / no-JS renders the final value so it is always correct without scripts.
  return <span ref={ref} className={className}>{value}</span>
}
