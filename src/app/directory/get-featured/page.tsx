import type { Metadata } from 'next'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import GetFeaturedForm from './GetFeaturedForm'
import { FEATURED_BENEFITS, FEATURED_MEMBER_FEE_AED, FEATURED_NON_MEMBER_FEE_AED } from '@/lib/featured-copy'
import { getGoogleReviews } from '@/lib/google-reviews'
import { Check, ArrowRight } from 'lucide-react'
import Link from 'next/link'

// Regenerated on the same timer as every other page that shows the Google
// rating badge. Left fully static, these pages froze their review count at
// deploy time while the homepage moved on, so two pages could show a
// different number of reviews on the same day.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Get Featured',
  description: 'Boost your business listing in the BILD Business Directory with Featured placement.',
}

export default async function GetFeaturedPage() {
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="Get Featured" subtitle="Stand out in the BILD Business Directory">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>
      <div className="py-16">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <ul className="text-left space-y-3 mb-10 max-w-md mx-auto">
            {FEATURED_BENEFITS.map(b => (
              <li key={b} className="flex items-start gap-2 text-charcoal-600">
                <Check size={18} className="text-gold-500 shrink-0 mt-0.5" /> {b}
              </li>
            ))}
          </ul>
          <p className="text-center text-charcoal-500 text-sm mb-10">
            {FEATURED_MEMBER_FEE_AED} AED/quarter for BILD members · {FEATURED_NON_MEMBER_FEE_AED} AED/quarter for non-BILD businesses
          </p>
          <div className="bg-cream border border-gold-200 rounded-2xl p-6">
            <p className="text-center text-charcoal-600 mb-5">
              Already have an approved listing? Enter your email and we&apos;ll send you your Get Featured link.
            </p>
            <GetFeaturedForm />
          </div>

          <div className="text-center mt-6">
            <p className="text-charcoal-600 text-sm">
              Don&rsquo;t have an approved listing yet? Get one here:
            </p>
            <Link
              href="/directory/submit"
              className="inline-flex items-center gap-1.5 text-gold-700 font-semibold text-sm mt-1.5 hover:underline"
            >
              List your business <ArrowRight size={15} />
            </Link>
            <p className="text-charcoal-500 text-xs mt-3 max-w-sm mx-auto leading-relaxed">
              Submitting is free. Once your listing is approved you can add Featured placement at any time.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
