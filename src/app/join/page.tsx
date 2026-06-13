import type { Metadata } from 'next'
import MembershipCard from '@/components/join/MembershipCard'
import FAQAccordion from '@/components/join/FAQAccordion'
import JoinForm from '@/components/join/JoinForm'
import PageHero from '@/components/ui/PageHero'

export const metadata: Metadata = { title: 'Join BILD' }

export default function JoinPage() {
  return (
    <>
      <PageHero title="Join BILD" subtitle="Become part of the British Indian community in Dubai" />
      <div className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12 items-start">
            {/* Membership summary */}
            <div className="lg:col-span-2 lg:sticky lg:top-24">
              <MembershipCard />
            </div>
            {/* The gated signup form */}
            <div className="lg:col-span-3" id="application">
              <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-2">Membership application</h2>
              <p className="text-charcoal-500 text-sm mb-6">
                Complete the steps below. Eligible applicants pay the one-off 50 AED contribution and receive their
                WhatsApp group invite instantly.
              </p>
              <JoinForm />
            </div>
          </div>

          <div className="max-w-3xl mx-auto mt-20">
            <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-6 text-center">Frequently Asked Questions</h2>
            <FAQAccordion />
          </div>
        </div>
      </div>
    </>
  )
}
