import Reveal from '@/components/anim/Reveal'
import { SITE_CONFIG } from '@/data/config'
import CountUp from '@/components/anim/CountUp'

// The headline number is the community itself. Everything else is evidence
// that it works, so the supporting stats sit in a smaller row underneath
// rather than competing with it on a flat four-across grid: a "WhatsApp
// Groups" at the same size as "2,000+ members" reads like a group chat, not
// like a network.
const supporting = [
  {
    value: String(SITE_CONFIG.whatsappCommunities),
    label: 'Specialist WhatsApp communities',
    sublabel: 'Parenting, property, food, business and more',
  },
  {
    value: '100',
    suffix: '+',
    label: 'Events hosted since 2019',
    sublabel: 'Socials, family days and celebrations',
  },
  {
    value: '2019',
    label: 'Established in Dubai',
    sublabel: 'Built by members, year after year',
  },
]

export default function CommunityStats() {
  return (
    <section className="py-20 bg-gold-100 border-y border-gold-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        <Reveal className="text-center mb-12">
          <span className="text-gold-500 font-semibold text-sm uppercase tracking-widest">Community by the Numbers</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal-800 mt-3">
            A community that is already thriving
          </h2>
          <p className="text-charcoal-500 mt-3 max-w-xl mx-auto">
            You are not joining something new. You are joining something that already works.
          </p>
        </Reveal>

        {/* The headline stat */}
        <Reveal y={36}>
          <div className="bg-charcoal-800 rounded-2xl px-7 py-10 text-center mb-6 hover:bg-charcoal-700 transition-colors duration-300">
            <p className="font-display text-6xl md:text-7xl font-bold text-gold-400 leading-none tracking-tight">
              <CountUp value="2,000" />
              <span className="align-baseline text-3xl md:text-4xl font-black">+</span>
            </p>
            <p className="text-white font-semibold text-lg md:text-xl mt-4">
              British Indians in the BILD community
            </p>
            <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
              Across the UAE, and still growing every week
            </p>
          </div>
        </Reveal>

        {/* Supporting evidence */}
        <Reveal className="grid grid-cols-1 sm:grid-cols-3 gap-6" stagger={0.12} y={28}>
          {supporting.map(stat => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-6 text-center border border-gold-200 hover:-translate-y-1 hover:shadow-md transition-all duration-300"
            >
              <p className="font-display text-4xl font-bold text-gold-600 mb-2 leading-none tracking-tight">
                <CountUp value={stat.value} />
                {stat.suffix && <span className="align-baseline text-xl">{stat.suffix}</span>}
              </p>
              <p className="text-charcoal-800 font-semibold text-sm mt-3">{stat.label}</p>
              <p className="text-charcoal-500 text-xs mt-1">{stat.sublabel}</p>
            </div>
          ))}
        </Reveal>

      </div>
    </section>
  )
}
