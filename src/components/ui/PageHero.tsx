interface PageHeroProps {
  title: string
  subtitle?: string
}

export default function PageHero({ title, subtitle }: PageHeroProps) {
  return (
    <div className="relative bg-charcoal-900 py-16 overflow-hidden">
      {/* Subtle pattern */}
      <div className="absolute inset-0 opacity-[0.05]" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="page-hero-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="25" fill="none" stroke="#C8861A" strokeWidth="0.6"/>
              <circle cx="30" cy="30" r="12" fill="none" stroke="#C8861A" strokeWidth="0.4"/>
              <line x1="5" y1="30" x2="55" y2="30" stroke="#C8861A" strokeWidth="0.3"/>
              <line x1="30" y1="5" x2="30" y2="55" stroke="#C8861A" strokeWidth="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#page-hero-pattern)"/>
        </svg>
      </div>
      <div className="absolute right-0 top-0 w-64 h-64 bg-gold-500 rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/3" />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">{title}</h1>
        {subtitle && <p className="text-gray-300 text-lg max-w-2xl mx-auto">{subtitle}</p>}
        <div className="mt-5 w-16 h-1 bg-gold-500 rounded-full mx-auto" />
      </div>
    </div>
  )
}
