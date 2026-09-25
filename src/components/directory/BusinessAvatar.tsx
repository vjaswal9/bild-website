'use client'

import { useState } from 'react'

// Deterministic warm palette so each business gets a stable colour
const PALETTE = [
  { bg: '#C8861A', fg: '#ffffff' }, // gold
  { bg: '#9B2335', fg: '#ffffff' }, // ruby
  { bg: '#2E2E2E', fg: '#e0a135' }, // charcoal + gold
  { bg: '#7d4e0a', fg: '#fdf8f0' }, // deep gold
  { bg: '#4A4A4A', fg: '#ffffff' }, // slate
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

// 'sm' is the old directory card. 'lg' is the business's own profile page,
// where the logo is the main visual: it uses object-contain on a plain
// background so wide wordmark logos show in full instead of being cropped,
// which is what object-cover does to them at this size.
//
// 'tile' and 'tileSm' are the directory listing rows: a flush square with a
// hairline edge and no inner padding, so a logo with its own background colour
// fills the square edge to edge instead of floating inside a rounded white
// frame. Same object-contain reasoning as 'lg'.
type Size = 'sm' | 'lg' | 'tile' | 'tileSm'

export default function BusinessAvatar({ name, logoUrl, size = 'sm' }: { name: string; logoUrl?: string; size?: Size }) {
  const [failed, setFailed] = useState(false)
  const showImage = logoUrl && !failed
  const colour = colourFor(name)
  const isLarge = size === 'lg'
  const contain = size === 'lg' || size === 'tile' || size === 'tileSm'

  const box =
    size === 'lg'
      ? 'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border border-gold-100 p-2'
      : size === 'tile'
        ? 'w-[104px] h-[104px] bg-white border border-gold-200/70'
        : size === 'tileSm'
          ? 'w-16 h-16 bg-white border border-gold-200/70'
          : 'w-14 h-14 rounded-xl'

  return (
    <div className={`${box} overflow-hidden shrink-0 flex items-center justify-center shadow-sm`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-display font-bold ${
            isLarge ? 'text-3xl rounded-xl' : size === 'tile' ? 'text-2xl' : 'text-lg'
          }`}
          style={{ backgroundColor: colour.bg, color: colour.fg }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  )
}
