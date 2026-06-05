const stats = [
  {
    value: '2,000+',
    label: 'Members',
    sublabel: 'and growing',
  },
  {
    value: '45',
    label: 'WhatsApp Groups',
    sublabel: 'active communities',
  },
  {
    value: '2019',
    label: 'Established',
    sublabel: 'in Dubai',
  },
  {
    value: '100s',
    label: 'Events Hosted',
    sublabel: 'and counting',
  },
]

export default function CommunityStats() {
  return (
    <section className="py-20 bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center mb-14">
          <span className="text-gold-500 font-semibold text-sm uppercase tracking-widest">Community by the Numbers</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal-800 mt-3">
            A community that is already thriving
          </h2>
          <p className="text-charcoal-500 mt-3 max-w-xl mx-auto">
            You are not joining something new. You are joining something that already works.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(stat => (
            <div
              key={stat.label}
              className="bg-charcoal-800 rounded-2xl p-7 text-center group hover:bg-charcoal-700 transition-colors"
            >
              <p className="font-display text-5xl md:text-6xl font-bold text-gold-400 mb-2 leading-none">
                {stat.value}
              </p>
              <p className="text-white font-semibold text-base mt-3">{stat.label}</p>
              <p className="text-gray-400 text-xs mt-1">{stat.sublabel}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
