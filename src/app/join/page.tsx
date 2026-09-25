import type { Metadata } from 'next'
import FAQAccordion from '@/components/join/FAQAccordion'
import JoinForm from '@/components/join/JoinForm'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import { getGoogleReviews } from '@/lib/google-reviews'

export const metadata: Metadata = {
  // Just 'Join': the title template already appends '| BILD'.
  title: 'Join',
  description: 'Join BILD for a one-off 50 AED membership fee and get access to British Indian events, WhatsApp groups, and the business directory in Dubai and the UAE.',
}

export const dynamic = 'force-dynamic'

export default async function JoinPage() {
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="Join BILD" subtitle="Become part of the British Indian community in Dubai">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>
      <div className="py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">

          {/* The gated application form */}
          <JoinForm googleReviews={googleReviews} />

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
