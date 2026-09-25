import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin } from 'lucide-react'
import { EventRow, isPastEvent } from '@/lib/events'
import { formatEventDate } from '@/lib/utils'
import TiltCard from '@/components/anim/TiltCard'

const tagGradients: Record<string, string> = {
  diwali:     'from-[#7d1a00] via-[#b34700] to-[#d97706]',
  festival:   'from-[#7d1a00] via-[#b34700] to-[#d97706]',
  cultural:   'from-[#1a2e5c] via-[#2d4a8a] to-[#4169b8]',
  social:     'from-[#1a3a2e] via-[#2d6b52] to-[#3d9970]',
  networking: 'from-[#2e1a3a] via-[#5a3272] to-[#8b5aad]',
  family:     'from-[#1a2e1a] via-[#3d6b3d] to-[#5a9e5a]',
}

function getGradient(tags: string[]): string {
  for (const tag of tags) {
    if (tagGradients[tag.toLowerCase()]) return tagGradients[tag.toLowerCase()]
  }
  return 'from-charcoal-800 via-charcoal-700 to-charcoal-600'
}

export default function EventCard({ event }: { event: EventRow }) {
  const isPast = isPastEvent(event)
  const tags = event.tags || []
  const gradient = getGradient(tags)
  const hasFlyer = !!event.flyer_url && event.flyer_url.startsWith('http')

  return (
    <TiltCard max={4}>
      <div className="bg-gold-50 rounded-2xl shadow-sm border border-gold-100 overflow-hidden hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group">
        <div className={`h-48 relative overflow-hidden ${hasFlyer ? 'bg-charcoal-900' : `bg-gradient-to-br ${gradient} flex items-center justify-center`}`}>
          {hasFlyer ? (
            // `fill` rather than fixed dimensions: the parent is a fixed-height
            // box, so the image has a reserved space and cannot shift the
            // layout. `sizes` stops a phone downloading the desktop-width file
            // for a card that is only ever a third of a wide screen.
            <Image
              src={event.flyer_url!}
              alt={event.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 400px"
              className="object-cover object-[center_20%] transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <span className="relative font-display text-white/30 text-5xl font-bold tracking-widest transition-transform duration-500 group-hover:scale-110">BILD</span>
          )}
          {isPast && (
            <span className="absolute top-3 left-3 bg-black/50 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Past Event
            </span>
          )}
        </div>
        <div className="p-6">
          <h3 className="font-display text-xl font-semibold text-charcoal-800 mb-3">{event.title}</h3>
          <div className="flex flex-col gap-2 mb-4 text-sm text-charcoal-600">
            <span className="flex items-center gap-2">
              <Calendar size={14} className="text-gold-500 shrink-0" />
              {formatEventDate(event.event_date)}
            </span>
            {(event.venue || event.location) && (
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-gold-500 shrink-0" />
                {[event.venue, event.location].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
          {event.description && (
            <p className="text-sm text-charcoal-600 mb-5 line-clamp-2">{event.description}</p>
          )}
          <div className="flex gap-3 items-center">
            <Link
              href={`/events/${event.slug}`}
              className="text-sm font-semibold text-charcoal-700 hover:text-gold-600 transition-colors"
            >
              {isPast ? 'View event →' : 'Learn more & register →'}
            </Link>
          </div>
        </div>
      </div>
    </TiltCard>
  )
}
