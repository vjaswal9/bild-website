import Reveal from '@/components/anim/Reveal'

export default function MissionStatement() {
  return (
    <section className="py-20 bg-cream border-t border-gold-200">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <Reveal x={-40} y={0}>
          <span className="text-gold-500 font-semibold text-sm uppercase tracking-widest">Who We Are</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal-800 mt-4 mb-6">
            Two cultures. One community.
          </h2>
        </Reveal>
        <Reveal x={40} y={0} delay={0.1}>
          <p className="text-lg text-charcoal-600 leading-relaxed mb-6">
            BILD is a membership network created exclusively for individuals of British Indian heritage, or the
            spouse or partner of someone who is, living in the UAE. We welcome those of Indian origin who were born,
            raised, or previously settled in
            the UK and identify with both British and Indian culture.
          </p>
        </Reveal>
        <Reveal x={-40} y={0} delay={0.15}>
          <p className="text-lg text-charcoal-600 leading-relaxed mb-6">
            This is a space where anyone who connects with our British Indian spirit can feel at home, whether you have
            lived in Dubai for years or have just arrived.
          </p>
        </Reveal>
        <Reveal x={40} y={0} delay={0.2}>
          <p className="text-lg text-charcoal-600 leading-relaxed">
            We connect members through cultural celebrations like Diwali, social meet-ups, family-friendly activities,
            and opportunities to support British Indian businesses, professionals, and entrepreneurs across the Emirates.
            While we embrace all faiths, BILD remains centred on the unique experiences of British Indians living abroad.
          </p>
        </Reveal>
        <Reveal className="mt-10 flex flex-wrap justify-center gap-3" stagger={0.08} y={16}>
          {['Born or raised in the UK', 'Indian heritage', 'Living in UAE', 'All faiths welcome', 'Family friendly'].map(tag => (
            <span key={tag} className="bg-gold-100 text-gold-700 border border-gold-200 px-4 py-1.5 rounded-full text-sm font-medium">
              {tag}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
