import type { Metadata } from 'next'
import Link from 'next/link'
import { Star } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import ReviewCard from '@/components/testimonials/ReviewCard'
import { GoogleWordmark } from '@/components/icons/GoogleLogo'
import { getCombinedReviews } from '@/lib/reviews'
import { btnPrimary, btnOutline } from '@/lib/ui'

export const metadata: Metadata = {
  title: 'Testimonials',
  description: 'What the BILD community says - Google reviews and member-submitted testimonials.',
}

// Reviews and testimonials change when an admin approves one, not per visitor. Five minutes of ISR replaces a live Google Places call and a database read on every single request.
//
// force-no-store was the damaging half: it overrode the 24 hour cache on
// the Google Places call, so every visit paid for a live API round trip
// before the first byte of HTML.
export const revalidate = 300

export default async function TestimonialsPage() {
  const { google, combined } = await getCombinedReviews()

  return (
    <>
      <PageHero title="Testimonials" subtitle="What the BILD community has to say">
        {google && (
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} className={i < Math.round(google.rating) ? 'fill-gold-400 text-gold-400' : 'text-white/20'} />
              ))}
            </div>
            <span className="text-white/90 text-sm font-medium">
              {google.rating.toFixed(1)} from {google.totalReviews} reviews on
            </span>
            <GoogleWordmark className="h-4 w-auto brightness-0 invert" />
          </div>
        )}
      </PageHero>

      <div className="py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/testimonials/submit" className={`${btnPrimary} px-6 py-3`}>
            Share your experience
          </Link>
          {google && (
            <a href={google.reviewUrl} target="_blank" rel="noopener noreferrer" className={`${btnOutline} px-6 py-3`}>
              Leave a Google Review
            </a>
          )}
        </div>

        {combined.length === 0 ? (
          <p className="text-charcoal-500 text-center py-12">No reviews yet - be the first to share your experience.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {combined.map((review, i) => (
              <ReviewCard key={i} review={review} />
            ))}
          </div>
        )}

        {google && (
          <p className="text-center mt-12">
            <a href={google.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-charcoal-600 hover:text-gold-600 text-sm font-medium underline underline-offset-4">
              See all {google.totalReviews} reviews on Google
            </a>
          </p>
        )}
      </div>
    </>
  )
}
