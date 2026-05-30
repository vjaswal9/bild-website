import type { Metadata } from 'next'
import MembershipCard from '@/components/join/MembershipCard'
import FAQAccordion from '@/components/join/FAQAccordion'
import PageHero from '@/components/ui/PageHero'

export const metadata: Metadata = { title: 'Join BILD' }

export default function JoinPage() {
  return (
    <>
      <PageHero title="Join BILD" subtitle="Become part of the British Indian community in Dubai" />
      <div className="py-12">
        {/* Fix 12 — stack on tablet, side by side only on lg+ */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 items-start">
            <div className="w-full lg:w-auto lg:flex-shrink-0">
              <MembershipCard />
            </div>
            <div className="w-full">
              <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-6">Frequently Asked Questions</h2>
              <FAQAccordion />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
