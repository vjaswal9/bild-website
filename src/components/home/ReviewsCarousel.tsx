'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Star, Quote } from 'lucide-react'
import { GoogleGMark } from '@/components/icons/GoogleLogo'

// A single shape for both Google reviews and BILD member-submitted
// testimonials, so one carousel can rotate through both sources.
export type CarouselReview = {
  source: 'google' | 'bild'
  author: string
  subtitle: string // Google's relative time (e.g. "2 months ago"), or a testimonial's headline
  rating: number
  text: string
  profilePhotoUrl?: string
}

const AUTO_ROTATE_MS = 6000

export default function ReviewsCarousel({ reviews }: { reviews: CarouselReview[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const dragStartX = useRef<number | null>(null)

  useEffect(() => {
    if (paused || reviews.length <= 1) return
    const id = setInterval(() => setIndex(i => (i + 1) % reviews.length), AUTO_ROTATE_MS)
    return () => clearInterval(id)
  }, [paused, reviews.length])

  function go(next: number) {
    setIndex(((next % reviews.length) + reviews.length) % reviews.length)
  }

  const review = reviews[index]
  if (!review) return null

  return (
    <div
      className="max-w-2xl mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { dragStartX.current = e.touches[0].clientX; setPaused(true) }}
      onTouchEnd={e => {
        if (dragStartX.current !== null) {
          const delta = e.changedTouches[0].clientX - dragStartX.current
          if (delta > 50) go(index - 1)
          else if (delta < -50) go(index + 1)
        }
        dragStartX.current = null
        setPaused(false)
      }}
    >
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          aria-label="Previous review"
          onClick={() => go(index - 1)}
          className="hidden sm:flex shrink-0 items-center justify-center w-10 h-10 self-center rounded-full border-2 border-gold-300 text-gold-600 hover:bg-gold-500 hover:text-white hover:border-gold-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="grid flex-1" aria-live="polite">
          {/* Changing the key remounts this card, which replays the CSS
              entrance. The outgoing card is not animated away, which is the
              one visible difference from the Framer Motion version this
              replaced, and not worth 122KB on the homepage to get back.
              prefers-reduced-motion is handled in globals.css. */}
          <div
            key={index}
            className="col-start-1 row-start-1 animate-slide-in bg-cream border border-gold-200 rounded-2xl p-6 sm:p-8 shadow-card flex flex-col"
          >
              <div className="flex items-start justify-between mb-3 shrink-0">
                <Quote size={28} className="text-gold-300" />
                {review.source === 'google' ? (
                  <span className="inline-flex items-center gap-1.5 bg-white border border-gold-100 rounded-full pl-2 pr-2.5 py-1">
                    <GoogleGMark className="h-3.5 w-3.5" />
                    <span className="text-charcoal-500 text-xs font-medium">Reviews from Google</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-gold-500/10 border border-gold-200 rounded-full px-2.5 py-1">
                    <span className="text-gold-600 text-xs font-medium">BILD member review</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mb-3 shrink-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className={i < review.rating ? 'fill-gold-500 text-gold-500' : 'text-gold-200'} />
                ))}
              </div>
              <p className="text-charcoal-700 leading-relaxed">{review.text}</p>
              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gold-100 shrink-0">
                {review.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={review.profilePhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gold-500 text-white flex items-center justify-center font-semibold">
                    {review.author.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-charcoal-800 text-sm">{review.author}</p>
                  {review.subtitle && <p className="text-charcoal-400 text-xs">{review.subtitle}</p>}
                </div>
              </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Next review"
          onClick={() => go(index + 1)}
          className="hidden sm:flex shrink-0 items-center justify-center w-10 h-10 self-center rounded-full border-2 border-gold-300 text-gold-600 hover:bg-gold-500 hover:text-white hover:border-gold-500 transition-colors"
        >
          <ArrowRight size={18} />
        </button>
      </div>

      {reviews.length > 1 && (
        <div className="flex items-center justify-center mt-6">
          {reviews.map((_, i) => (
            // The padding (not the dot) is what makes this a 24px+ tap target,
            // so the dots stay small visually but are still easy to hit on a phone.
            <button
              key={i}
              type="button"
              aria-label={`Go to review ${i + 1}`}
              onClick={() => go(i)}
              className="group px-2 py-3 flex items-center"
            >
              <span
                className={`block h-2 rounded-full transition-all ${i === index ? 'w-6 bg-gold-500' : 'w-2 bg-gold-200 group-hover:bg-gold-300'}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
