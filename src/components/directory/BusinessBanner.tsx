'use client'

import { useState } from 'react'

/**
 * Wide hero image at the top of a business profile.
 *
 * Only renders when the business has actually uploaded a banner - there is no
 * generated placeholder.
 *
 * Two treatments, because businesses supply two very different kinds of image:
 *
 * - Transparent logos (a PNG with the background removed) go on white. On a
 *   dark or blurred background the fill shows through the transparent areas
 *   and the logo looks washed out.
 * - Everything else keeps its own colours, fitted whole over a dimmed, blurred
 *   copy of itself, so an off-shape image is never cropped and never sits on
 *   dead space.
 *
 * A correctly sized wide banner fills the frame either way.
 */
export default function BusinessBanner({
  name, bannerUrl, transparent = false,
}: { name: string; bannerUrl?: string; transparent?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (!bannerUrl || failed) return null

  const frame = 'relative w-full aspect-[3/1] sm:aspect-[4/1] rounded-2xl overflow-hidden mb-6'

  if (transparent) {
    return (
      <div className={`${frame} bg-white border border-gold-100`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bannerUrl}
          alt={`${name} banner`}
          className="absolute inset-0 w-full h-full object-contain p-4"
          onError={() => setFailed(true)}
        />
      </div>
    )
  }

  return (
    <div className={`${frame} bg-charcoal-900`}>
      {/* Dimmed blurred fill, so a narrow or square image does not sit on bare space. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bannerUrl}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40 brightness-[0.55]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bannerUrl}
        alt={`${name} banner`}
        className="absolute inset-0 w-full h-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
