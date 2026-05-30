'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-charcoal-900">
      {/* Rich layered gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-charcoal-900 via-[#1a1208] to-[#2d1a0a]" />

      {/* Mandala / geometric pattern overlay — SVG inline for zero network cost */}
      <div className="absolute inset-0 opacity-[0.06]" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="mandala-grid" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#C8861A" strokeWidth="0.8"/>
              <circle cx="60" cy="60" r="35" fill="none" stroke="#C8861A" strokeWidth="0.6"/>
              <circle cx="60" cy="60" r="20" fill="none" stroke="#C8861A" strokeWidth="0.5"/>
              <line x1="10" y1="60" x2="110" y2="60" stroke="#C8861A" strokeWidth="0.4"/>
              <line x1="60" y1="10" x2="60" y2="110" stroke="#C8861A" strokeWidth="0.4"/>
              <line x1="25" y1="25" x2="95" y2="95" stroke="#C8861A" strokeWidth="0.3"/>
              <line x1="95" y1="25" x2="25" y2="95" stroke="#C8861A" strokeWidth="0.3"/>
              <circle cx="60" cy="10" r="3" fill="#C8861A"/>
              <circle cx="60" cy="110" r="3" fill="#C8861A"/>
              <circle cx="10" cy="60" r="3" fill="#C8861A"/>
              <circle cx="110" cy="60" r="3" fill="#C8861A"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mandala-grid)"/>
        </svg>
      </div>

      {/* Gold glow accents */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gold-500 rounded-full blur-[120px] opacity-10 -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-ruby-500 rounded-full blur-[100px] opacity-10 translate-y-1/3 -translate-x-1/4" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="inline-block bg-gold-500/20 text-gold-400 border border-gold-500/30 text-sm font-medium px-4 py-1.5 rounded-full mb-6 tracking-wide">
            British Indians Living in Dubai
          </span>

          <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Where British Heritage
            <br />
            <span className="text-gold-400">Meets Indian Heart</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            A not-for-profit community exclusively for British Indians living in the UAE.
            Connect, celebrate, and grow together.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/join"
              className="bg-gold-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gold-600 transition-all hover:shadow-lg hover:shadow-gold-500/25 hover:-translate-y-0.5"
            >
              Join BILD
            </Link>
            <Link
              href="/events"
              className="border-2 border-white/30 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/10 hover:border-white/50 transition-all"
            >
              Explore Events
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  )
}
