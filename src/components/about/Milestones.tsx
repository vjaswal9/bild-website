import Reveal from '@/components/anim/Reveal'
import { getPublishedMilestones } from '@/lib/milestones'

// The timeline is edited in the admin area (Milestones) and stored in the
// database, so it no longer needs a deploy to change. A real sequence, so it
// is marked by year rather than by step number.
export default async function Milestones() {
  const milestones = await getPublishedMilestones()
  if (milestones.length === 0) return null

  return (
    <section className="py-20 bg-charcoal-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-12">
          <span className="text-gold-400 font-semibold text-sm uppercase tracking-widest">How we got here</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mt-3">
            Seven years, one community
          </h2>
        </Reveal>

        <Reveal stagger={0.1} y={24}>
          {milestones.map((m, i) => (
            <div key={m.id} className="relative pl-8 sm:pl-12 pb-10 last:pb-0">
              {/* The connecting line stops at the last entry rather than
                  trailing off past it. */}
              {i < milestones.length - 1 && (
                <span className="absolute left-[5px] sm:left-[7px] top-4 bottom-0 w-px bg-gold-500/30" aria-hidden="true" />
              )}
              <span className="absolute left-0 top-2 w-3 h-3 rounded-full bg-gold-500 ring-4 ring-gold-500/15" aria-hidden="true" />
              <p className="text-gold-400 text-sm font-semibold tracking-widest uppercase">{m.year_label}</p>
              <h3 className="font-display text-xl md:text-2xl font-bold text-white mt-1 mb-2">{m.title}</h3>
              <p className="text-gray-400 leading-relaxed max-w-2xl">{m.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
