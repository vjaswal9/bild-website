'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

export default function SuccessCelebration() {
  useEffect(() => {
    // A full-screen particle burst is squarely what prefers-reduced-motion
    // exists to suppress. For someone with vestibular sensitivity this was the
    // most physically unpleasant thing on the site, and it was the one
    // animation with no guard at all. They still get the page, just not the
    // confetti.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const gold = ['#C8861A', '#e0a135', '#F4F1EC', '#ffffff']
    // Two staggered bursts from the lower corners
    const fire = (x: number) =>
      confetti({ particleCount: 60, spread: 70, origin: { x, y: 0.7 }, colors: gold, scalar: 0.9 })
    fire(0.25)
    setTimeout(() => fire(0.75), 200)
    setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.6 }, colors: gold }), 400)
  }, [])
  return null
}
