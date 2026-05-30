import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, Tag, ArrowLeft } from 'lucide-react'
import eventsData from '@/data/events.json'
import { BildEvent } from '@/lib/types'
import { formatEventDate, formatEventTime } from '@/lib/utils'
import { SITE_CONFIG } from '@/data/config'

export function generateStaticParams() {
  return eventsData.events.map(e => ({ slug: e.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const event = eventsData.events.find(e => e.slug === params.slug)
  return { title: event?.title ?? 'Event' }
}

export default function EventDetailPage({ params }: { params: { slug: string } }) {
  const event = eventsData.events.find(e => e.slug === params.slug) as BildEvent | undefined
  if (!event) notFound()

  const isPast = event.status === 'past'
  const isPlaceholderLink = !event.stripeLink || event.stripeLink.startsWith('REPLACE_ME')

  return (
    <div className="py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/events" className="inline-flex items-center gap-2 text-charcoal-600 hover:text-saffron-600 mb-8 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Events
        </Link>

        <div className="h-64 bg-gradient-to-br from-charcoal-700 to-charcoal-900 rounded-2xl flex items-center justify-center mb-8">
          <span className="font-display text-white/10 text-8xl font-bold">BILD</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {event.tags.map(tag => (
            <span key={tag} className="bg-saffron-100 text-saffron-700 text-xs font-medium px-3 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-bold text-charcoal-800 mb-6">{event.title}</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 p-6 bg-gray-50 rounded-xl">
          <div className="flex items-start gap-3">
            <Calendar size={18} className="text-saffron-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-charcoal-500 font-medium uppercase tracking-wide">Date</p>
              <p className="text-sm text-charcoal-800 font-semibold">{formatEventDate(event.date)}</p>
              <p className="text-sm text-charcoal-600">{formatEventTime(event.date)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-saffron-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-charcoal-500 font-medium uppercase tracking-wide">Venue</p>
              <p className="text-sm text-charcoal-800 font-semibold">{event.venue}</p>
              <p className="text-sm text-charcoal-600">{event.location}</p>
            </div>
          </div>
          {event.ticketPrice !== undefined && (
            <div className="flex items-start gap-3">
              <Tag size={18} className="text-saffron-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-charcoal-500 font-medium uppercase tracking-wide">Ticket Price</p>
                <p className="text-sm text-charcoal-800 font-semibold">
                  {event.ticketPrice === 0 ? 'Free' : `${event.ticketPrice} ${event.currency}`}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="prose prose-lg text-charcoal-700 mb-10">
          <p>{event.description}</p>
        </div>

        {!isPast && !isPlaceholderLink && (
          <a
            href={event.stripeLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-saffron-500 text-white px-10 py-4 rounded-xl font-semibold text-lg hover:bg-saffron-600 transition-all hover:shadow-lg"
          >
            Sign Up for This Event
          </a>
        )}

        {!isPast && isPlaceholderLink && (
          <a
            href={`mailto:${SITE_CONFIG.contactEmail}?subject=Event Enquiry: ${event.title}`}
            className="inline-block bg-charcoal-700 text-white px-10 py-4 rounded-xl font-semibold text-lg hover:bg-charcoal-800 transition-all"
          >
            Contact Us to Register
          </a>
        )}

        {isPast && (
          <Link
            href={`/photo-vault?event=${event.slug}`}
            className="inline-block border-2 border-charcoal-700 text-charcoal-700 px-10 py-4 rounded-xl font-semibold text-lg hover:bg-charcoal-700 hover:text-white transition-all"
          >
            View Event Photos →
          </Link>
        )}
      </div>
    </div>
  )
}
