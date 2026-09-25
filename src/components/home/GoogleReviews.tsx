import { Star } from 'lucide-react'
import Link from 'next/link'
import { getCombinedReviews } from '@/lib/reviews'
import { btnOutline } from '@/lib/ui'
import { GoogleWordmark } from '@/components/icons/GoogleLogo'
import ReviewsCarousel from './ReviewsCarousel'

export default async function GoogleReviews() {
  const { google, combined } = await getCombinedReviews()
  if (!google && combined.length === 0) return null

  return (
    <section className="py-20 bg-gold-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-gold-500 font-semibold text-sm uppercase tracking-widest">What Our Members Say</span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal-800 mt-3">
            Loved by the BILD Community
          </h2>
          {google && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={18} className={i < Math.round(google.rating) ? 'fill-gold-500 text-gold-500' : 'text-gold-200'} />
                ))}
              </div>
              <span className="text-charcoal-600 font-medium text-sm">
                {google.rating.toFixed(1)} from {google.totalReviews} reviews on
              </span>
              <GoogleWordmark className="h-4 w-auto" />
            </div>
          )}
        </div>

        {combined.length > 0 && <ReviewsCarousel reviews={combined} />}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link href="/testimonials" className={`${btnOutline} px-6 py-3`}>
            See all reviews
          </Link>
          <Link href="/testimonials/submit" className="text-charcoal-600 hover:text-gold-600 text-sm font-medium underline underline-offset-4">
            Share your experience
          </Link>
          {google && (
            <a href={google.reviewUrl} target="_blank" rel="noopener noreferrer" className="text-charcoal-600 hover:text-gold-600 text-sm font-medium underline underline-offset-4">
              Leave a Google Review
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
