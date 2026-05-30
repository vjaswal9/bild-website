import type { Metadata } from 'next'
import MembershipCard from '@/components/join/MembershipCard'
import FAQAccordion from '@/components/join/FAQAccordion'
import SectionHeading from '@/components/ui/SectionHeading'

export const metadata: Metadata = { title: 'Join BILD' }

export default function JoinPage() {
  return (
    <div className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Join BILD"
          subtitle="Become part of the British Indian community in Dubai"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start max-w-5xl mx-auto">
          <div>
            <MembershipCard />
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-6">Frequently Asked Questions</h2>
            <FAQAccordion />
          </div>
        </div>
      </div>
    </div>
  )
}
