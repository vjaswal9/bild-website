import { Star } from 'lucide-react'
import { getGoogleReviews } from '@/lib/google-reviews'
import { GoogleWordmark } from '@/components/icons/GoogleLogo'

// Compact star rating shown next to the business name at the top of its profile,
// so the rating is visible without scrolling to the full reviews section lower
// down. Both read the same 24h-cached fetch, so showing it twice costs no extra
// Google API calls. Renders nothing when the business has no Place ID linked.
export default async function BusinessGoogleRatingSummary({ placeId }: { placeId: string }) {
  const data = await getGoogleReviews(placeId)
  if (!data) return null

  return (
    <a
      href={data.reviewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 mt-2 group"
      title={`${data.rating.toFixed(1)} out of 5 from ${data.totalReviews} Google reviews`}
    >
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={14} className={i < Math.round(data.rating) ? 'fill-gold-500 text-gold-500' : 'text-gold-200'} />
        ))}
      </span>
      <span className="text-charcoal-700 font-semibold text-sm">{data.rating.toFixed(1)}</span>
      <span className="text-charcoal-500 text-sm group-hover:text-gold-600 transition-colors">
        ({data.totalReviews})
      </span>
      <GoogleWordmark className="h-3 w-auto" />
    </a>
  )
}
