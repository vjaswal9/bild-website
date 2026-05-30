const stats = [
  { value: '2000+', label: 'Members' },
  { value: '59+', label: 'Events Hosted' },
  { value: '60+', label: 'Businesses Listed' },
  { value: '2019', label: 'Est. in Dubai' },
]

export default function CommunityStats() {
  return (
    <section className="bg-charcoal-900 py-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(stat => (
            <div key={stat.label}>
              <p className="font-display text-4xl md:text-5xl font-bold text-gold-400 mb-2">{stat.value}</p>
              <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
