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
    description: 'Become a BILD member for just 50 AED (lifetime) and connect with hundreds of British Indians in Dubai.',
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
                    ? 'bg-saffron-500 text-white shadow-lg'
                    : 'bg-gold-50 shadow-sm border border-gold-200'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                  card.highlight ? 'bg-white/20' : 'bg-saffron-100'
                }`}>
                  <Icon size={24} className={card.highlight ? 'text-white' : 'text-saffron-600'} />
                </div>
                <h3 className={`font-display text-xl font-semibold mb-3 ${card.highlight ? 'text-white' : 'text-charcoal-800'}`}>
                  {card.title}
                </h3>
                <p className={`text-sm leading-relaxed mb-6 flex-1 ${card.highlight ? 'text-white/85' : 'text-charcoal-600'}`}>
                  {card.description}
                </p>
                <Link
                  href={card.href}
                  className={`text-sm font-semibold inline-flex items-center gap-1 ${
                    card.highlight ? 'text-white hover:underline' : 'text-saffron-600 hover:text-saffron-700'
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
