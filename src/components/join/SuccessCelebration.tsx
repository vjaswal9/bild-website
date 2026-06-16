'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

export default function SuccessCelebration() {
  useEffect(() => {
    const gold = ['#C8A64B', '#E0A135', '#F4F1EC', '#ffffff']
    // Two staggered bursts from the lower corners
    const fire = (x: number) =>
      confetti({ particleCount: 60, spread: 70, origin: { x, y: 0.7 }, colors: gold, scalar: 0.9 })
    fire(0.25)
    setTimeout(() => fire(0.75), 200)
    setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.6 }, colors: gold }), 400)
  }, [])
  return null
}
