'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-charcoal-900">

      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-charcoal-900 via-[#1a1208] to-[#1a0a14]" />

      {/* Union Jack cross/saltire pattern — very faded */}
      <div className="absolute inset-0" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="uj" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              {/* Diagonal saltires */}
              <line x1="0" y1="0" x2="200" y2="200" stroke="#C9A84C" strokeWidth="14" opacity="0.18"/>
              <line x1="200" y1="0" x2="0" y2="200" stroke="#C9A84C" strokeWidth="14" opacity="0.18"/>
              {/* Narrow counter lines in ruby */}
              <line x1="0" y1="0" x2="200" y2="200" stroke="#8B1A2B" strokeWidth="5" opacity="0.18"/>
              <line x1="200" y1="0" x2="0" y2="200" stroke="#8B1A2B" strokeWidth="5" opacity="0.18"/>
              {/* Horizontal bar */}
              <rect x="0" y="80" width="200" height="40" fill="#C9A84C" opacity="0.12"/>
              <rect x="0" y="88" width="200" height="24" fill="#8B1A2B" opacity="0.12"/>
              {/* Vertical bar */}
              <rect x="80" y="0" width="40" height="200" fill="#C9A84C" opacity="0.12"/>
              <rect x="88" y="0" width="24" height="200" fill="#8B1A2B" opacity="0.12"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#uj)" opacity="0.08"/>
        </svg>
      </div>

      {/* Gold glow top right */}
      <div
        className="absolute top-0 right-0 w-[520px] h-[520px] rounded-full blur-[150px] opacity-15 -translate-y-1/2 translate-x-1/3"
        style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }}
      />
      {/* Ruby glow bottom left */}
      <div
        className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-[120px] opacity-10 translate-y-1/3 -translate-x-1/4"
        style={{ background: 'radial-gradient(circle, #8B1A2B 0%, transparent 70%)' }}
      />

      {/* Content */}
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
