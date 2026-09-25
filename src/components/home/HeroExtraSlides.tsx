'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { HeroPhoto as HeroPhotoType } from '@/lib/hero-photos'

// The photographs after the first one, mounted once the page has settled.
//
// All ten used to render at once. Because they are stacked absolutely inside
// the first screenful, every one of them counted as "in the viewport", so the
// browser's lazy loading did nothing and it queued ten full-bleed photographs
// immediately, all competing with the one image the visitor is actually
// waiting to see. On a phone that is the difference between the hero appearing
// and the hero appearing eventually.
//
// Only the first photograph is server-rendered now. The rest arrive here, after
// the browser says it is idle, by which time the first one has had the
// connection to itself. Nobody sees a difference: the second photograph is not
// due on screen for several seconds.
export default function HeroExtraSlides({
  images,
  step,
  fade,
  startIndex,
}: {
  images: HeroPhotoType[]
  step: number
  fade: number
  startIndex: number
}) {
  // Seconds between the page loading and these slides mounting.
  //
  // This matters more than it looks. A CSS animation starts when its element
  // is created, so a slide mounted two seconds late would run two seconds
  // behind the first one and the cross-fade would drift apart. Subtracting the
  // elapsed time from each delay puts them back on the same clock as the
  // photograph that was there from the start.
  const [elapsed, setElapsed] = useState<number | null>(null)

  useEffect(() => {
    const mount = () => setElapsed(performance.now() / 1000)
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(mount, { timeout: 2500 })
      return () => (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(id)
    }
    // Safari has no requestIdleCallback. A short timer is close enough, and
    // the point is only to let the first photograph load first.
    const t = setTimeout(mount, 1200)
    return () => clearTimeout(t)
  }, [])

  if (elapsed == null) return null

  return (
    <>
      {images.map((img, n) => {
        const i = startIndex + n
        const delay = `${i * step - fade - elapsed}s`
        return (
          <div
            key={img.src}
            className="bild-hero-slide absolute inset-0 overflow-hidden"
            style={{ animationDelay: delay }}
            aria-hidden
          >
            <div
              className={`relative h-full w-full bild-hero-drift bild-hero-drift-${i % 4}`}
              style={{ animationDelay: delay }}
            >
              {img.mobileSrc && (
                <Image
                  src={img.mobileSrc}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover sm:hidden"
                  style={{ objectPosition: img.position || 'center' }}
                />
              )}
              <Image
                src={img.src}
                alt=""
                fill
                sizes="100vw"
                className={`object-cover${img.mobileSrc ? ' hidden sm:block' : ''}`}
                style={{ objectPosition: img.position || 'center' }}
              />
            </div>
          </div>
        )
      })}
    </>
  )
}
