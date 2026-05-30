import Link from 'next/link'
import { Calendar, MapPin, Tag } from 'lucide-react'
import { BildEvent } from '@/lib/types'
import { formatEventDate } from '@/lib/utils'

export default function EventCard({ event }: { event: BildEvent }) {
  const isPast = event.status === 'past'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-48 bg-gradient-to-br from-charcoal-700 to-charcoal-900 flex items-center justify-center relative">
        <span className="font-display text-white/20 text-6xl font-bold">BILD</span>
        {event.isFeatured && !isPast && (
          <span className="absolute top-4 left-4 bg-saffron-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Featured
          </span>
        )}
        {isPast && (
          <span className="absolute top-4 left-4 bg-charcoal-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Past Event
          </span>
        )}
      </div>
      <div className="p-6">
        <h3 className="font-display text-xl font-semibold text-charcoal-800 mb-3">{event.title}</h3>
        <div className="flex flex-col gap-2 mb-4 text-sm text-charcoal-600">
          <span className="flex items-center gap-2">
            <Calendar size={14} className="text-saffron-500 shrink-0" />
            {formatEventDate(event.date)}
          </span>
          <span className="flex items-center gap-2">
            <MapPin size={14} className="text-saffron-500 shrink-0" />
            {event.venue}, {event.location}
          </span>
          {event.ticketPrice !== undefined && (
            <span className="flex items-center gap-2">
              <Tag size={14} className="text-saffron-500 shrink-0" />
              {event.ticketPrice === 0 ? 'Free' : `${event.ticketPrice} ${event.currency}`}
            </span>
          )}
        </div>
        <p className="text-sm text-charcoal-600 mb-5 line-clamp-2">{event.shortDescription}</p>
        <div className="flex gap-3">
          <Link
            href={`/events/${event.slug}`}
            className="text-sm font-semibold text-charcoal-700 hover:text-saffron-600 transition-colors"
          >
            Learn more →
          </Link>
          {!isPast && event.stripeLink && event.stripeLink !== 'REPLACE_ME_STRIPE_DIWALI_2025' && event.stripeLink !== 'REPLACE_ME_STRIPE_SUMMER_2025' && (
            <a
              href={event.stripeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto bg-saffron-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-saffron-600 transition-colors"
            >
              Sign Up
            </a>
          )}
          {isPast && (
            <Link
              href={`/photo-vault?event=${event.slug}`}
              className="ml-auto text-sm text-charcoal-500 hover:text-saffron-600 transition-colors"
            >
              View Photos →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
