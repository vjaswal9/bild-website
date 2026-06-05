interface PageHeroProps {
  title: string
  subtitle?: string
}

export default function PageHero({ title, subtitle }: PageHeroProps) {
  return (
    <div className="relative bg-charcoal-900 py-16 overflow-hidden">
      <div className="absolute right-0 top-0 w-64 h-64 bg-gold-500 rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/3" />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">{title}</h1>
        {subtitle && <p className="text-gray-300 text-lg max-w-2xl mx-auto">{subtitle}</p>}
        <div className="mt-5 w-16 h-1 bg-gold-500 rounded-full mx-auto" />
      </div>
    </div>
  )
}
