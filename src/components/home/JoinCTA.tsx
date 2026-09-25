import Link from 'next/link'
import { btnPrimary } from '@/lib/ui'

export default function JoinCTA() {
  return (
    <section className="py-20 bg-charcoal-800">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to join the BILD community?
        </h2>
        <p className="text-gray-300 text-lg mb-8">
          Connect with British Indians across Dubai and the UAE.
        </p>
        <Link href="/join" className={`${btnPrimary} px-10 py-4 text-lg hover:scale-105 transition-transform animate-pulse-glow`}>
          Join BILD ⭐
        </Link>
      </div>
    </section>
  )
}
