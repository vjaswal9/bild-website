import Link from 'next/link'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { btnPrimary } from '@/lib/ui'
import { GoogleGMark } from '@/components/icons/GoogleLogo'
import HeroExtraSlides from './HeroExtraSlides'

// Photograph-led hero, proposed to replace the particle-network one.
//
// Three deliberate departures from the live hero:
//   - a real BILD event photograph instead of an abstract animated background,
//     because the community's own faces are the most persuasive thing it has;
//   - the headline set left rather than centred, breaking the centre-everything
//     rhythm that runs down the whole page;
//   - the proof sat beside the headline instead of below the fold, so the
//     member count, the Google rating and the next event are all in the first
//     frame.
//
// Pass one image for a still hero, or several to cross-fade between them.
export default function HeroPhoto({
  images,
  googleRating,
  nextEvent,
  memberCount = '2,000+',
}: {
  // `position` is the CSS object-position for that photograph. A wide hero
  // always crops a landscape frame top and bottom, so each one says which band
  // of itself matters, rather than every photograph surrendering its middle.
  //
  // `mobileSrc` is an optional second crop of the same photograph, used only on
  // a phone. A wide shot whose subject is off to one side survives the desktop
  // hero intact but is far too small to read on a phone; a tighter crop of the
  // part that matters is shown there instead.
  images: { src: string; alt: string; position?: string; mobileSrc?: string }[]
  googleRating?: { rating: number; totalReviews: number; mapsUrl: string } | null
  nextEvent?: { title: string; date: string; slug: string } | null
  memberCount?: string
}) {
  const slides = images.length ? images : []
  const cycling = slides.length > 1

  // Timings. Each photograph holds for about eight seconds and takes three to
  // give way to the next, which is slow enough to read as a change of scene
  // rather than a slideshow clicking over.
  const step = 8           // seconds from one photograph appearing to the next
  const fade = 3           // seconds of overlap while two are on screen
  const cycle = slides.length * step

  // Percentages for one slide's turn inside the whole cycle.
  const pct = (seconds: number) => Math.round((seconds / cycle) * 1000) / 10
  const inAt = pct(fade)
  const holdTo = pct(step)
  const outAt = pct(step + fade)

  return (
    <section className="relative isolate overflow-hidden bg-charcoal-900 flex flex-col sm:flex-row sm:items-center sm:min-h-[92vh]">
      {cycling && (
        <style>{`
          @keyframes bildHeroFade {
            0% { opacity: 0 }
            ${inAt}% { opacity: 1 }
            ${holdTo}% { opacity: 1 }
            ${outAt}% { opacity: 0 }
            100% { opacity: 0 }
          }

          /* The movement. Every drift runs its whole range between 0% and
             ${outAt}%, which is exactly the window in which its photograph is on
             screen; the rest of the cycle it sits still and invisible. Spreading
             the movement across the full cycle instead, as this first did, meant
             a viewer only ever saw about a seventh of it, which is why it read
             as almost no movement at all.

             Four drifts take turns so the effect never looks like one repeated
             trick: a pan right, a push in, a pan left, a pull out. The pans hold
             a steady 7% overscale, which is what gives them room to travel. */
          @keyframes bildHeroPanRight {
            0%          { transform: scale(1.07) translate3d(-2.2%, 0, 0) }
            ${outAt}%   { transform: scale(1.07) translate3d(2.2%, 0, 0) }
            100%        { transform: scale(1.07) translate3d(2.2%, 0, 0) }
          }
          @keyframes bildHeroPanLeft {
            0%          { transform: scale(1.07) translate3d(2.2%, 0, 0) }
            ${outAt}%   { transform: scale(1.07) translate3d(-2.2%, 0, 0) }
            100%        { transform: scale(1.07) translate3d(-2.2%, 0, 0) }
          }
          @keyframes bildHeroPushIn {
            0%          { transform: scale(1) }
            ${outAt}%   { transform: scale(1.09) }
            100%        { transform: scale(1.09) }
          }
          @keyframes bildHeroPullOut {
            0%          { transform: scale(1.09) }
            ${outAt}%   { transform: scale(1) }
            100%        { transform: scale(1) }
          }

          .bild-hero-slide {
            opacity: 0;
            animation: bildHeroFade ${cycle}s linear infinite;
          }
          .bild-hero-drift {
            animation-duration: ${cycle}s;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
            will-change: transform;
          }
          .bild-hero-drift-0 { animation-name: bildHeroPanRight }
          .bild-hero-drift-1 { animation-name: bildHeroPushIn }
          .bild-hero-drift-2 { animation-name: bildHeroPanLeft }
          .bild-hero-drift-3 { animation-name: bildHeroPullOut }

          @media (prefers-reduced-motion: reduce) {
            .bild-hero-slide { animation: none; opacity: 0 }
            .bild-hero-slide:first-of-type { opacity: 1 }
            .bild-hero-drift { animation: none; transform: none }
          }
        `}</style>
      )}

      {/* The photographs.
          On a phone they are a band of their own, close to the shape of the
          photographs themselves, so nearly the whole frame is visible. A tall
          narrow hero with the words laid over it can only ever show a sliver of
          a landscape photograph, however short it is made. From small screens up
          there is room for both, so the photograph goes back to filling the
          hero and the words sit on top of it. */}
      <div className="relative w-full aspect-[3/2] sm:absolute sm:inset-0 sm:aspect-auto -z-20">
        {/* Only the first photograph is rendered here. The rest mount once the
            browser is idle, so they stop competing with it for bandwidth.
            See HeroExtraSlides for why that matters and how the cross-fade
            stays in step. */}
        {slides.slice(0, 1).map((img, i) => (
          <div
            key={img.src}
            className={cycling ? 'bild-hero-slide absolute inset-0 overflow-hidden' : 'absolute inset-0 overflow-hidden'}
            // A negative delay on the first photograph starts it already at full
            // opacity, so the page never opens on an empty dark frame.
            style={cycling ? { animationDelay: `${i * step - fade}s` } : undefined}
            aria-hidden={i > 0}
          >
            <div
              className={`relative h-full w-full ${cycling ? `bild-hero-drift bild-hero-drift-${i % 4}` : ''}`}
              style={cycling ? { animationDelay: `${i * step - fade}s` } : undefined}
            >
              {img.mobileSrc && (
                <Image
                  src={img.mobileSrc}
                  alt={i === 0 ? img.alt : ''}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover sm:hidden"
                  style={{ objectPosition: img.position || 'center' }}
                />
              )}
              <Image
                src={img.src}
                alt={i === 0 ? img.alt : ''}
                fill
                priority={i === 0}
                sizes="100vw"
                className={`object-cover${img.mobileSrc ? ' hidden sm:block' : ''}`}
                style={{ objectPosition: img.position || 'center' }}
              />
            </div>
          </div>
        ))}

        {cycling && (
          <HeroExtraSlides images={slides.slice(1)} step={step} fade={fade} startIndex={1} />
        )}

        {/* On a phone the band has to meet the words below it without a seam. */}
        <div
          className="absolute inset-x-0 bottom-0 h-28 sm:hidden"
          style={{ background: 'linear-gradient(to top, #171310, transparent)' }}
        />
      </div>

      {/* Scrim: heavy on the left where the words sit, clearing to the right so
          the photograph is still a photograph. Only from small screens up, where
          the words are over the photograph at all. */}
      <div
        className="hidden sm:block absolute inset-0 -z-10"
        style={{ background: 'linear-gradient(100deg, rgba(10,8,6,0.94) 0%, rgba(10,8,6,0.86) 28%, rgba(10,8,6,0.45) 62%, rgba(10,8,6,0.25) 100%)' }}
      />
      <div
        className="hidden sm:block absolute inset-x-0 bottom-0 h-40 -z-10"
        style={{ background: 'linear-gradient(to top, rgba(10,8,6,0.8), transparent)' }}
      />

      <div className="relative w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-8 pb-14 sm:py-24">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-10 lg:gap-16 items-end">

          <div className="max-w-2xl">
            <p className="text-gold-400 text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] mb-4 sm:mb-5">
              British Indians in the UAE, since 2019
            </p>

            <h1 className="font-display text-[2.25rem] leading-[1.08] sm:text-6xl lg:text-7xl font-bold text-white mb-5 sm:mb-6">
              Where British Heritage
              <br />
              <span className="text-gold-400">Meets Indian Heart</span>
            </h1>

            <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-xl mb-8 sm:mb-9">
              Friendships, family days, cultural nights and sporting activities, a professional
              network, and a directory that backs British Indian business.
            </p>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link href="/join" className={`${btnPrimary} px-8 py-4 text-lg`}>
                Join BILD
              </Link>
              <Link
                href="/events"
                className="text-white font-medium underline underline-offset-8 decoration-gold-500/60 hover:decoration-gold-400 transition-colors"
              >
                See what&rsquo;s on
              </Link>
            </div>
          </div>

          {/* Proof, beside the headline on desktop and under it on a phone.
              It sits where the scrim has already cleared, so on the daylight
              photographs it was reading against bright water and white shirts.
              A soft plate of its own and a shadow on the type keep it legible
              whichever photograph is showing, without blacking out that side
              of the frame. */}
          <dl
            className="flex flex-row lg:flex-col gap-x-8 gap-y-6 lg:gap-y-7 lg:border-l lg:border-white/20 lg:pl-8 lg:pr-6 lg:py-7 lg:rounded-r-xl lg:bg-[linear-gradient(90deg,rgba(10,8,6,0.6),rgba(10,8,6,0.2))] flex-wrap"
            style={{ textShadow: '0 1px 14px rgba(10,8,6,0.95), 0 0 5px rgba(10,8,6,0.75)' }}
          >
            <div>
              <dt className="text-white/75 text-xs uppercase tracking-[0.14em] mb-1.5">Members</dt>
              <dd className="font-display text-3xl lg:text-4xl font-bold text-white leading-none">{memberCount}</dd>
            </div>

            {googleRating && (
              <div>
                <dt className="text-white/75 text-xs uppercase tracking-[0.14em] mb-1.5">Rated</dt>
                <dd>
                  <a
                    href={googleRating.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 group"
                  >
                    <span className="font-display text-3xl lg:text-4xl font-bold text-white leading-none">
                      {googleRating.rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={i < Math.round(googleRating.rating) ? 'fill-gold-400 text-gold-400' : 'text-white/25'} />
                      ))}
                    </span>
                    <GoogleGMark className="h-3.5 w-3.5 opacity-80 group-hover:opacity-100 transition-opacity" />
                  </a>
                </dd>
              </div>
            )}

            {nextEvent && (
              <div className="min-w-[10rem]">
                <dt className="text-white/75 text-xs uppercase tracking-[0.14em] mb-1.5">Next up</dt>
                <dd>
                  <Link href={`/events/${nextEvent.slug}`} className="block group">
                    <span className="block text-white font-semibold leading-snug group-hover:text-gold-400 transition-colors">
                      {nextEvent.title}
                    </span>
                    <span className="block text-white/60 text-sm mt-0.5">
                      {new Date(nextEvent.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' })}
                    </span>
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  )
}
