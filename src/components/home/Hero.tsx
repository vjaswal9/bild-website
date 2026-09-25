'use client'

import Link from 'next/link'
import { Star } from 'lucide-react'
import HeroPlexus from './HeroPlexus'
import { LAUNCH_MODE } from '@/lib/launch'
import { btnPrimary, btnOutlineOnDark } from '@/lib/ui'
import { GoogleGMark } from '@/components/icons/GoogleLogo'

type Props = {
  googleRating?: { rating: number; totalReviews: number; mapsUrl: string } | null
}

export default function Hero({ googleRating }: Props) {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-charcoal-900">

      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-charcoal-900 via-[#1a1208] to-[#15100a]" />

      {/* Animated gold plexus network */}
      <HeroPlexus />

      {/* Soft radial vignette so the headline stays the focus */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(17,17,17,0.55) 100%)' }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <span className="inline-block bg-gold-500/20 text-gold-400 border border-gold-500/30 text-sm font-medium px-4 py-1.5 rounded-full mb-6 tracking-wide animate-fade-up">
          The British Indian community in the UAE
        </span>

        {/* This headline is the page's Largest Contentful Paint element, so it
            uses the CSS fade-up animation rather than a motion component: CSS
            runs at first paint, whereas a JS animation keeps it invisible until
            React has hydrated, which measured ~5s on a throttled phone. */}
        <h1
          className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight animate-fade-up"
        >
          <span className="block text-xl md:text-2xl text-gold-400 font-semibold tracking-widest mb-2">BILD</span>
          Where British Heritage
          <br />
          {/* Fades in with the headline rather than on its own JS timer, so the
              whole title lands as one unit at first paint. */}
          <span className="text-gold-400">
            Meets Indian Heart
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up-d2">
          Founded in Dubai in 2019 and now 2,000+ members strong. A place to
          <span className="text-white font-medium"> belong</span>,
          <span className="text-white font-medium"> connect</span> and
          <span className="text-white font-medium"> grow</span> - friendships and family events,
          a professional network, and a directory that backs British Indian business.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up-d3">
          <Link href="/join" className={`${btnPrimary} px-8 py-4 text-lg hover:scale-105 transition-transform`}>
            Join BILD ⭐
          </Link>
          <Link href={LAUNCH_MODE ? '/about' : '/events'} className={`${btnOutlineOnDark} px-8 py-4 text-lg hover:scale-105 transition-transform`}>
            {LAUNCH_MODE ? 'About BILD' : 'Explore Events'}
          </Link>
        </div>

        {googleRating && (
          <a
            href={googleRating.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-8 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors animate-fade-up-d4"
          >
            <GoogleGMark className="h-4 w-4" />
            <span className="text-white/90 text-sm font-semibold">{googleRating.rating.toFixed(1)}</span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} className={i < Math.round(googleRating.rating) ? 'fill-gold-400 text-gold-400' : 'text-white/20'} />
              ))}
            </div>
            <span className="text-white/50 text-sm underline underline-offset-2">({googleRating.totalReviews} reviews)</span>
          </a>
        )}
      </div>

      {/* Keeps its bounce, but no entrance fade: a CSS animation slot can only
          hold one animation, and the bounce is the point of this arrow. */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  )
}
