'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { SITE_CONFIG } from '@/data/config'

export default function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center bg-gradient-to-br from-charcoal-900 via-charcoal-800 to-charcoal-700 overflow-hidden">
      {/* Decorative saffron accent */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-saffron-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-saffron-400 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="inline-block bg-saffron-500/20 text-saffron-400 border border-saffron-500/30 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            British Indians Living in Dubai
          </span>

          <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Where British Heritage
            <br />
            <span className="text-saffron-400">Meets Indian Heart</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            A not-for-profit community exclusively for British Indians living in the UAE.
            Connect, celebrate, and grow together.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/join"
              className="bg-saffron-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-saffron-600 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              Join BILD — {SITE_CONFIG.membershipFeeAED} AED/year
            </Link>
            <Link
              href="/events"
              className="border-2 border-white/30 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/10 transition-all"
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
