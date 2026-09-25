import { Star } from 'lucide-react'
import { getGoogleReviews } from '@/lib/google-reviews'
import { GoogleWordmark } from '@/components/icons/GoogleLogo'
import ReviewsCarousel, { CarouselReview } from '@/components/home/ReviewsCarousel'

export default async function BusinessGoogleReviews({ placeId }: { placeId: string }) {
  const data = await getGoogleReviews(placeId)
  if (!data) return null

  const carouselReviews: CarouselReview[] = data.reviews.map(r => ({
    source: 'google' as const,
    author: r.author,
    subtitle: r.relativeTime,
    rating: r.rating,
    text: r.text,
    profilePhotoUrl: r.profilePhotoUrl,
  }))

  return (
    <div className="mt-8 pt-8 border-t border-gold-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={16} className={i < Math.round(data.rating) ? 'fill-gold-500 text-gold-500' : 'text-gold-200'} />
          ))}
        </div>
        <span className="text-charcoal-600 font-medium text-sm">
          {data.rating.toFixed(1)} from {data.totalReviews} reviews on
        </span>
        <GoogleWordmark className="h-3.5 w-auto" />
      </div>

      {carouselReviews.length > 0 && <ReviewsCarousel reviews={carouselReviews} />}

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
        <a href={data.reviewUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gold-600 hover:text-gold-700 underline underline-offset-4">
          Leave a Review
        </a>
        <span className="hidden sm:inline text-charcoal-300">·</span>
        <a href={data.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-charcoal-600 hover:text-gold-600 underline underline-offset-4">
          See all {data.totalReviews} reviews on Google
        </a>
      </div>
    </div>
  )
}
