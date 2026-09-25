import { Star, Quote } from 'lucide-react'
import { GoogleGMark } from '@/components/icons/GoogleLogo'
import type { CarouselReview } from '@/components/home/ReviewsCarousel'

export default function ReviewCard({ review }: { review: CarouselReview }) {
  return (
    <div className="bg-cream border border-gold-200 rounded-2xl p-6 shadow-card flex flex-col h-full">
      <div className="flex items-start justify-between mb-3 shrink-0">
        <Quote size={24} className="text-gold-300" />
        {review.source === 'google' ? (
          <span className="inline-flex items-center gap-1.5 bg-white border border-gold-100 rounded-full pl-2 pr-2.5 py-1">
            <GoogleGMark className="h-3.5 w-3.5" />
            <span className="text-charcoal-500 text-xs font-medium">Google</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-gold-500/10 border border-gold-200 rounded-full px-2.5 py-1">
            <span className="text-gold-600 text-xs font-medium">BILD member</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 mb-3 shrink-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={14} className={i < review.rating ? 'fill-gold-500 text-gold-500' : 'text-gold-200'} />
        ))}
      </div>
      <p className="text-charcoal-700 leading-relaxed text-sm flex-1">{review.text}</p>
      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gold-100 shrink-0">
        {review.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.profilePhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gold-500 text-white flex items-center justify-center font-semibold text-sm">
            {review.author.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold text-charcoal-800 text-sm">{review.author}</p>
          {review.subtitle && <p className="text-charcoal-400 text-xs">{review.subtitle}</p>}
        </div>
      </div>
    </div>
  )
}
