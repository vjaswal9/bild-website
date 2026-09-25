import Link from 'next/link'
import { SITE_CONFIG } from '@/data/config'
import { Heart, Handshake, TrendingUp } from 'lucide-react'
import { btnPrimary } from '@/lib/ui'
import Reveal from '@/components/anim/Reveal'
import TiltCard from '@/components/anim/TiltCard'

// Three pillars rather than a flat list of benefits. A long list gives every
// feature equal weight and makes an established network read like a WhatsApp
// group; grouping them shows what BILD actually is and who it is for.
const pillars = [
  {
    icon: Heart,
    name: 'Belong',
    promise: 'Your people, already here.',
    description:
      `Friendships that outlast the group chat. ${SITE_CONFIG.whatsappCommunities} WhatsApp communities, social nights, cultural celebrations and family days, whether you landed last month or a decade ago.`,
    points: [`${SITE_CONFIG.whatsappCommunities} WhatsApp communities`, 'Cultural celebrations', 'Family-friendly events'],
  },
  {
    icon: Handshake,
    name: 'Connect',
    promise: 'Who you know, without starting over.',
    description:
      'Professional networking with entrepreneurs, executives and specialists who share your background. Introductions, recommendations from people who have already done it, and the knowledge that takes years to build alone.',
    points: ['Professional networking', 'Warm introductions', 'Member knowledge base'],
  },
  {
    icon: TrendingUp,
    name: 'Grow',
    promise: 'A community that backs its own.',
    description:
      'Visibility for your business in the BILD Business Directory, member offers from across the network, and a straightforward way to support British Indian businesses in the UAE and UK.',
    points: ['Business Directory listing', 'Member-only offers', 'Reach 2,000+ members'],
  },
]

export default function WhyJoin() {
  return (
    <section className="py-20 bg-charcoal-900 relative overflow-hidden">

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Reveal className="text-center mb-14">
          <span className="inline-block bg-gold-500/20 text-gold-400 border border-gold-500/30 text-sm font-semibold px-4 py-1.5 rounded-full mb-4 tracking-wide uppercase">
            Why Join BILD?
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Belong. Connect. Grow.
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            One membership, three things every British Indian in the UAE needs: a community to belong to, a network to
            draw on, and a place for your business to be seen.
          </p>
        </Reveal>

        {/* The three pillars */}
        <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14" stagger={0.12} y={28}>
          {pillars.map(pillar => {
            const Icon = pillar.icon
            return (
              <TiltCard key={pillar.name} max={4}>
                <div className="flex flex-col h-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-500/40 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1.5 group">
                  <div className="w-12 h-12 rounded-xl bg-gold-500/20 flex items-center justify-center mb-5 transition-all duration-300 group-hover:bg-gold-500/30 group-hover:scale-110 group-hover:rotate-6">
                    <Icon size={24} className="text-gold-400" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white tracking-wide uppercase">{pillar.name}</h3>
                  <p className="text-gold-400 font-medium mt-1 mb-3">{pillar.promise}</p>
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">{pillar.description}</p>
                  <ul className="mt-auto space-y-1.5">
                    {pillar.points.map(point => (
                      <li key={point} className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </TiltCard>
            )
          })}
        </Reveal>

        {/* CTA */}
        <div className="text-center">
          <Link href="/join" className={`${btnPrimary} px-10 py-4 text-lg`}>
            Join BILD ⭐
          </Link>
        </div>
      </div>
    </section>
  )
}
