'use client'

import { useEffect, useRef } from 'react'

// Animated plexus / network background in BILD gold.
// Drifting nodes connected by lines that fade with distance.

type Particle = { x: number; y: number; vx: number; vy: number; r: number; glow: boolean }

export default function HeroPlexus() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const context = canvasEl.getContext('2d')
    if (!context) return
    const canvas: HTMLCanvasElement = canvasEl
    const ctx: CanvasRenderingContext2D = context

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let dpr = 1
    let particles: Particle[] = []
    let rafId = 0

    const LINK_DIST = 150 // px in CSS space
    const GOLD = '198, 134, 26' // #C8861A rgb
    const GOLD_LIGHT = '224, 161, 53' // #E0A135 rgb

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Particle count scales with area, capped for performance
      const count = Math.min(90, Math.max(28, Math.floor((width * height) / 16000)))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.8,
        glow: Math.random() < 0.18,
      }))
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)

      // Move + draw connection lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy

        // Wrap around edges softly
        if (p.x < -20) p.x = width + 20
        if (p.x > width + 20) p.x = -20
        if (p.y < -20) p.y = height + 20
        if (p.y > height + 20) p.y = -20

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.28
            ctx.strokeStyle = `rgba(${GOLD}, ${alpha})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      for (const p of particles) {
        if (p.glow) {
          ctx.shadowColor = `rgba(${GOLD_LIGHT}, 0.9)`
          ctx.shadowBlur = 8
          ctx.fillStyle = `rgba(${GOLD_LIGHT}, 0.85)`
        } else {
          ctx.shadowBlur = 0
          ctx.fillStyle = `rgba(${GOLD}, 0.55)`
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }

    function loop() {
      draw()
      rafId = requestAnimationFrame(loop)
    }

    resize()

    if (reduceMotion) {
      // Static single frame, no animation
      // Freeze velocities so draw() renders one stable frame
      particles.forEach(p => { p.vx = 0; p.vy = 0 })
      draw()
    } else {
      loop()
    }

    let resizeTimer: ReturnType<typeof setTimeout>
    function onResize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(resize, 150)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      clearTimeout(resizeTimer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  )
}
