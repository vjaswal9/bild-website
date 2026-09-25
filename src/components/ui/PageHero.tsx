import HeroPlexus from '@/components/home/HeroPlexus'
import Reveal from '@/components/anim/Reveal'

interface PageHeroProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export default function PageHero({ title, subtitle, children }: PageHeroProps) {
  return (
    <div className="relative bg-charcoal-900 py-20 overflow-hidden">
      {/* Warm base gradient (matches the homepage hero) */}
      <div className="absolute inset-0 bg-gradient-to-br from-charcoal-900 via-[#1a1208] to-[#15100a]" />

      {/* Animated gold plexus network */}
      <HeroPlexus />

      {/* Soft vignette so the heading stays the focus */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(17,17,17,0.55) 100%)' }}
      />

      <Reveal className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">{title}</h1>
        {subtitle && <p className="text-gray-300 text-lg max-w-2xl mx-auto">{subtitle}</p>}
        <div className="mt-5 w-16 h-1 bg-gold-500 rounded-full mx-auto" />
        {children && <div className="mt-6">{children}</div>}
      </Reveal>
    </div>
  )
}
