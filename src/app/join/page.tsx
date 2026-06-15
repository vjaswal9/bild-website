import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import FAQAccordion from '@/components/join/FAQAccordion'
import JoinForm from '@/components/join/JoinForm'
import PageHero from '@/components/ui/PageHero'

export const metadata: Metadata = { title: 'Join BILD' }

const perks = [
  'Access to 45 groups & 2,000+ members',
  'Exclusive events & celebrations',
  'Members-only business directory',
  'Lifetime access, one-off fee',
]

export default function JoinPage() {
  return (
    <>
      <PageHero title="Join BILD" subtitle="Become part of the British Indian community in Dubai" />
      <div className="py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">

          {/* Membership summary banner */}
          <div className="relative overflow-hidden bg-charcoal-800 rounded-3xl p-7 sm:p-8 mb-10">
            <div
              className="absolute top-0 right-0 w-56 h-56 rounded-full blur-[90px] opacity-20 -translate-y-1/3 translate-x-1/4"
              style={{ background: 'radial-gradient(circle, #C8861A 0%, transparent 70%)' }}
            />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div>
                <p className="text-gold-400 text-xs uppercase tracking-widest font-semibold">Lifetime Membership</p>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-white font-display text-5xl font-bold leading-none">50</span>
                  <span className="text-gray-300 text-lg mb-1">AED</span>
                </div>
                <p className="text-gray-400 text-sm mt-1">One-off contribution. No renewals.</p>
              </div>
              <ul className="space-y-1.5">
                {perks.map(p => (
                  <li key={p} className="flex items-center gap-2 text-sm text-gray-200">
                    <Check size={15} className="text-gold-400 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* The gated application form */}
          <JoinForm />

          {/* FAQ */}
          <div className="mt-20">
            <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-6 text-center">Frequently Asked Questions</h2>
            <FAQAccordion />
          </div>
        </div>
      </div>
    </>
  )
}
