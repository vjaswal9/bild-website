import Link from 'next/link'
import { SITE_CONFIG } from '@/data/config'
import { Users, Store, ArrowRight } from 'lucide-react'
import Reveal from '@/components/anim/Reveal'
import { btnPrimary } from '@/lib/ui'
import { isLivePath } from '@/lib/launch'

// Two different people arrive on this page: someone looking for a community,
// and a business looking for customers. They want different things and pay
// for different things, so the split is made explicit straight after the hero
// rather than leaving the business route buried in the nav.
export default function TwoJourneys() {
  return (
    <section className="py-16 bg-cream border-b border-gold-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        <Reveal className="text-center mb-10">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-charcoal-800">
            What brings you to BILD?
          </h2>
        </Reveal>

        <Reveal className={`grid grid-cols-1 gap-6 ${isLivePath('/directory') ? 'md:grid-cols-2' : 'max-w-md mx-auto'}`} stagger={0.12} y={28}>

          {/* Member journey */}
          <div className="flex flex-col bg-white rounded-2xl border border-gold-200 p-8 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-gold-100 flex items-center justify-center mb-5">
              <Users size={24} className="text-gold-600" />
            </div>
            <h3 className="font-display text-xl font-bold text-charcoal-800 mb-2">
              I want to join BILD
            </h3>
            <p className="text-charcoal-600 text-sm leading-relaxed mb-6 flex-1">
              For British Indians living in the UAE. Events, family days, cultural celebrations and {SITE_CONFIG.whatsappCommunities} specialist
              WhatsApp groups.
            </p>
            <Link href="/join" className={`${btnPrimary} w-full py-3.5 text-base`}>
              Join BILD <ArrowRight size={18} />
            </Link>
          </div>

          {/* Business journey: goes while the directory is switched off */}
          {isLivePath('/directory') && (
          <div className="flex flex-col bg-white rounded-2xl border border-gold-200 p-8 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-charcoal-800 flex items-center justify-center mb-5">
              <Store size={24} className="text-gold-400" />
            </div>
            <h3 className="font-display text-xl font-bold text-charcoal-800 mb-2">
              I want to list my business
            </h3>
            <p className="text-charcoal-600 text-sm leading-relaxed mb-6 flex-1">
              Get in front of 2,000+ British Indians across the UAE with a profile in the BILD Business Directory.
              Open to BILD members and non-members alike.
            </p>
            <Link href="/directory/submit" className={`${btnPrimary} w-full py-3.5 text-base`}>
              List Your Business <ArrowRight size={18} />
            </Link>
          </div>
          )}

        </Reveal>

      </div>
    </section>
  )
}
