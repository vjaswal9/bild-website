import { Star } from 'lucide-react'
import { GoogleGMark } from '@/components/icons/GoogleLogo'

// Everywhere else this badge sits inside a dark PageHero, so its colours were
// written straight into the markup. The directory now opens on cream, where
// white-on-white made the rating itself invisible - hence the tone, rather than
// a second near-identical component.
export default function GoogleRatingBadge({
  rating,
  totalReviews,
  mapsUrl,
  tone = 'dark',
  align = 'center',
}: {
  rating: number
  totalReviews: number
  mapsUrl: string
  tone?: 'dark' | 'light'
  align?: 'center' | 'left'
}) {
  const light = tone === 'light'
  return (
    <div className={`flex flex-col gap-2 ${align === 'left' ? 'items-start' : 'items-center'}`}>
      <div
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
          light ? 'bg-white border border-gold-200' : 'bg-white/5 border border-white/10'
        }`}
      >
        <GoogleGMark className="h-4 w-4" />
        <span className={`text-sm font-semibold ${light ? 'text-charcoal-800' : 'text-white/90'}`}>
          {rating.toFixed(1)}
        </span>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={13}
              className={
                i < Math.round(rating)
                  ? 'fill-gold-400 text-gold-400'
                  : light
                    ? 'text-gold-200'
                    : 'text-white/20'
              }
            />
          ))}
        </div>
        <span className={`text-sm ${light ? 'text-charcoal-500' : 'text-white/50'}`}>({totalReviews} reviews)</span>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-xs font-medium hover:underline ${light ? 'text-gold-700' : 'text-gold-400'}`}
      >
        See all reviews on Google
      </a>
    </div>
  )
}
