'use client'

import { useState } from 'react'

// Deterministic warm palette so each business gets a stable colour
const PALETTE = [
  { bg: '#C8861A', fg: '#ffffff' }, // gold
  { bg: '#9B2335', fg: '#ffffff' }, // ruby
  { bg: '#374151', fg: '#E0A135' }, // charcoal + gold
  { bg: '#7d4e0a', fg: '#fdf8f0' }, // deep gold
  { bg: '#4B5563', fg: '#ffffff' }, // slate
  { bg: '#b45309', fg: '#ffffff' }, // amber
]

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function colourFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export default function BusinessAvatar({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false)
  const showImage = logoUrl && !failed
  const colour = colourFor(name)

  return (
    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-display font-bold text-lg"
          style={{ backgroundColor: colour.bg, color: colour.fg }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  )
}
