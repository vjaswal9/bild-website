import Reveal from '@/components/anim/Reveal'
import { UserPlus, Heart, Network, Briefcase, Sparkles } from 'lucide-react'

// The rest of the homepage explains what BILD does. This section says what
// membership actually feels like, which is the reason people join. Outcomes,
// not features.
const outcomes = [
  { icon: UserPlus, title: 'Meet people', line: 'Familiar faces in a city where you arrived knowing nobody.' },
  { icon: Heart, title: 'Make friends', line: 'The kind you call on a Sunday, not just the ones in a group chat.' },
  { icon: Network, title: 'Build connections', line: 'A network of British Indians who understand where you started.' },
  { icon: Briefcase, title: 'Discover opportunities', line: 'Work, clients, advice and introductions that come from knowing people.' },
  { icon: Sparkles, title: 'Celebrate who you are', line: 'Diwali, cricket, Sunday roasts and everything in between.' },
]

export default function FindYourPeople() {
  return (
    <section className="py-20 bg-charcoal-800 relative overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        <Reveal className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            You don&rsquo;t just join BILD.
            <br />
            <span className="text-gold-400">You find your people.</span>
          </h2>
          <p className="text-gray-300 text-lg mt-5 max-w-2xl mx-auto leading-relaxed">
            Moving to the UAE is easy. Feeling at home takes people who get it, without you having to
            explain yourself. That is what BILD is for.
          </p>
        </Reveal>

        <Reveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" stagger={0.1} y={28}>
          {outcomes.map(item => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="bg-white/5 border border-white/10 hover:border-gold-500/40 hover:bg-white/10 rounded-2xl p-6 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-gold-400" />
                </div>
                <h3 className="text-white font-semibold text-lg">{item.title}</h3>
                <p className="text-gray-400 text-sm mt-2 leading-relaxed">{item.line}</p>
              </div>
            )
          })}
        </Reveal>

      </div>
    </section>
  )
}
