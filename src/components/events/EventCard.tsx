import Link from 'next/link'
import { Calendar, MapPin, Tag } from 'lucide-react'
import { BildEvent } from '@/lib/types'
import { formatEventDate } from '@/lib/utils'

const tagGradients: Record<string, string> = {
  diwali:     'from-[#7d1a00] via-[#b34700] to-[#d97706]',
  festival:   'from-[#7d1a00] via-[#b34700] to-[#d97706]',
  cultural:   'from-[#1a2e5c] via-[#2d4a8a] to-[#4169b8]',
  social:     'from-[#1a3a2e] via-[#2d6b52] to-[#3d9970]',
  networking:'from-[#2e1a3a] via-[#5a3272] to-[#8b5aad]',
  family:     'from-[#1a2e1a] via-[#3d6b3d] to-[#5a9e5a]',
}

function getGradient(tags: string[]): string {
  for (const tag of tags) {
    if (tagGradients[tag.toLowerCase()]) return tagGradients[tag.toLowerCase()]
  }
  return 'from-charcoal-800 via-charcoal-700 to-charcoal-600'
}

export default function EventCard({ event }: { event: BildEvent }) {
  const isPast = event.status === 'past'
  const gradient = getGradient(event.tags)

  return (
    <div className="bg-gold-50 rounded-2xl shadow-sm border border-gold-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className={`h-48 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id={`card-${event.id}`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="16" fill="none" stroke="white" strokeWidth="0.5"/>
                <circle cx="20" cy="20" r="8" fill="none" stroke="white" strokeWidth="0.4"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#card-${event.id})`}/>
          </svg>
        </div>
        <span className="relative font-display text-white/30 text-5xl font-bold tracking-widest">BILD</span>
        {event.isFeatured && !isPast && (
          <span className="absolute top-3 left-3 bg-gold-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Featured
          </span>
        )}
        {isPast && (
          <span className="absolute top-3 left-3 bg-black/40 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Past Event
          </span>
        )}
      </div>
      <div className="p-6">
        <h3 className="font-display text-xl font-semibold text-charcoal-800 mb-3">{event.title}</h3>
        <div className="flex flex-col gap-2 mb-4 text-sm text-charcoal-600">
          <span className="flex items-center gap-2">
            <Calendar size={14} className="text-gold-500 shrink-0" />
            {formatEventDate(event.date)}
          </span>
          <span className="flex items-center gap-2">
            <MapPin size={14} className="text-gold-500 shrink-0" />
            {event.venue}, {event.location}
          </span>
          {event.ticketPrice !== undefined && (
            <span className="flex items-center gap-2">
              <Tag size={14} className="text-gold-500 shrink-0" />
              {event.ticketPrice === 0 ? 'Free' : `${event.ticketPrice} ${event.currency}`}
            </span>
          )}
        </div>
        <p className="text-sm text-charcoal-600 mb-5 line-clamp-2">{event.shortDescription}</p>
        <div className="flex gap-3 items-center">
          <Link
            href={`/events/${event.slug}`}
            className="text-sm font-semibold text-charcoal-700 hover:text-gold-600 transition-colors"
          >
            Learn more →
          </Link>
          {!isPast && event.stripeLink && !event.stripeLink.startsWith('REPLACE_ME') && (
            <a
              href={event.stripeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto bg-gold-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-gold-600 transition-colors"
            >
              Sign Up
            </a>
          )}
          {isPast && (
            <Link
              href={`/photo-vault?event=${event.slug}`}
              className="ml-auto text-sm text-charcoal-500 hover:text-gold-600 transition-colors"
            >
              View Photos →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
