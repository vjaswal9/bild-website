import Link from 'next/link'
import { Calendar, Building2, Users } from 'lucide-react'

const cards = [
  {
    icon: Calendar,
    title: 'Events & Celebrations',
    description: 'Diwali, social meet-ups, family days, and more. Experience British Indian culture in Dubai.',
    href: '/events',
    cta: 'View Events',
  },
  {
    icon: Building2,
    title: 'Business Directory',
    description: 'Find and support British Indian businesses and professionals across the UAE.',
    href: '/directory',
    cta: 'Browse Directory',
  },
  {
    icon: Users,
    title: 'Join the Community',
    description: 'Become a BILD member and connect with hundreds of British Indians living in Dubai and across the UAE.',
    href: '/join',
    cta: 'Join BILD',
    highlight: true,
  },
]

export default function HighlightCards() {
  return (
    <section className="py-20 bg-gold-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.title}
                className={`rounded-2xl p-8 flex flex-col transition-all hover:-translate-y-1 hover:shadow-xl ${
                  card.highlight
                    ? 'bg-charcoal-800 text-white shadow-lg'
                    : 'bg-cream shadow-sm border border-gold-200'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                  card.highlight ? 'bg-gold-500/20' : 'bg-gold-100'
                }`}>
                  <Icon size={24} className={card.highlight ? 'text-gold-400' : 'text-gold-600'} />
                </div>
                <h3 className={`font-display text-xl font-semibold mb-3 ${card.highlight ? 'text-white' : 'text-charcoal-800'}`}>
                  {card.title}
                </h3>
                <p className={`text-sm leading-relaxed mb-6 flex-1 ${card.highlight ? 'text-gray-300' : 'text-charcoal-600'}`}>
                  {card.description}
                </p>
                <Link
                  href={card.href}
                  className={`text-sm font-semibold inline-flex items-center gap-1 ${
                    card.highlight ? 'text-gold-400 hover:text-gold-300' : 'text-gold-600 hover:text-gold-700'
                  }`}
                >
                  {card.cta} →
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
