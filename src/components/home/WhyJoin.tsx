import Link from 'next/link'
import { Users, Calendar, Building2, Briefcase, MessageCircle, Heart } from 'lucide-react'

const benefits = [
  {
    icon: Calendar,
    title: 'Exclusive Events',
    description: 'Diwali celebrations, social nights, family days, and cultural gatherings, all designed for British Indians in Dubai.',
  },
  {
    icon: Users,
    title: 'Instant Community',
    description: 'Join a private WhatsApp group of 2,000+ like-minded British Indians. Your people, already here.',
  },
  {
    icon: Building2,
    title: 'Business Directory',
    description: 'Access and list in our members-only directory. Find trusted British Indian professionals across every sector.',
  },
  {
    icon: Briefcase,
    title: 'Professional Network',
    description: 'Connect with entrepreneurs, executives, and experts who share your background and understand your journey.',
  },
  {
    icon: Heart,
    title: 'Family-Friendly',
    description: 'Activities for the whole family. Build friendships for your children and connections for yourself.',
  },
  {
    icon: MessageCircle,
    title: 'Support Network',
    description: 'Whether you\'ve just arrived or been here for years. BILD is your home away from home.',
  },
]

export default function WhyJoin() {
  return (
    <section className="py-20 bg-charcoal-900 relative overflow-hidden">

<div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block bg-gold-500/20 text-gold-400 border border-gold-500/30 text-sm font-semibold px-4 py-1.5 rounded-full mb-4 tracking-wide uppercase">
            Why Join BILD?
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Everything you get as a member
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            One lifetime membership. Unlimited access to a community that gets you.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
          {benefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <div
                key={benefit.title}
                className="flex gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-500/40 rounded-2xl p-6 transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-gold-500/20 flex items-center justify-center shrink-0 group-hover:bg-gold-500/30 transition-colors">
                  <Icon size={22} className="text-gold-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{benefit.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{benefit.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/join"
            className="inline-block bg-gold-500 text-white px-10 py-4 rounded-xl text-lg font-semibold hover:bg-gold-600 transition-all hover:shadow-lg hover:shadow-gold-500/25 hover:-translate-y-0.5"
          >
            Become a Member: 50 AED for Life
          </Link>
          <p className="text-gray-500 text-sm mt-3">One-off lifetime fee. No renewals. No hidden costs.</p>
        </div>
      </div>
    </section>
  )
}
