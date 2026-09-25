import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, ArrowLeft } from 'lucide-react'
import { getEventBySlug } from '@/lib/events-server'
import { isPastEvent } from '@/lib/events'
import { formatEventDate, formatEventTime } from '@/lib/utils'
import EventRegistration from './EventRegistration'
import EventGallery from './EventGallery'
import AddToCalendar from '@/components/events/AddToCalendar'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const SITE_URL = 'https://www.bild.ae'

// Flattens the WhatsApp-style announcement into a clean sentence run for
// search engines: drops the *emphasis* markers, the emoji and the blank
// lines that would otherwise be shown verbatim in a result snippet.
function plainDescription(raw: string): string {
  return raw
    .replace(/[*_~`]/g, '')
    // Emoji: the astral-plane pairs, then the BMP symbol blocks and the
    // variation selector. Written without the /u flag to match tsconfig.
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D]/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 900)
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getEventBySlug(params.slug)
  if (!data) return { title: 'Event' }
  const { event } = data
  const description = event.description
    ? plainDescription(event.description).slice(0, 155)
    : `${event.title} - a BILD event for British Indians in Dubai and the UAE. ${formatEventDate(event.event_date)}.`
  const images = event.flyer_url && event.flyer_url.startsWith('http') ? [event.flyer_url] : undefined
  return {
    title: event.title,
    description,
    openGraph: { title: event.title, description, images },
    twitter: { title: event.title, description, images },
  }
}

export default async function EventDetailPage({ params }: { params: { slug: string } }) {
  const data = await getEventBySlug(params.slug)
  if (!data || data.event.status !== 'published') notFound()

  const { event, tickets, remaining } = data
  const isPast = isPastEvent(event)
  const hasFlyer = !!event.flyer_url && event.flyer_url.startsWith('http')
  const gallery = event.gallery || []

  // Google only shows an event as a rich result (a date badge, a venue and a
  // "from AED x" ticket line) when the ticket offers are in the structured
  // data. The prices are already on the page, so they go in here too.
  const eventUrl = `${SITE_URL}/events/${event.slug}`
  const availability = isPast || remaining === 0
    ? 'https://schema.org/SoldOut'
    : 'https://schema.org/InStock'

  const offers = tickets.map(ticket => ({
    '@type': 'Offer',
    // Ticket names are typed by hand in the admin and often end in a colon
    // ("Adult Ticket:"). Search engines show this verbatim, so trim it here.
    name: ticket.name.replace(/[\s:.-]+$/, ''),
    price: String(ticket.price_aed),
    priceCurrency: 'AED',
    availability,
    url: eventUrl,
    ...(event.created_at ? { validFrom: event.created_at } : {}),
  }))

  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.event_date,
    ...(event.end_date ? { endDate: event.end_date } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: eventUrl,
    // The stored description is the WhatsApp announcement, complete with
    // *asterisk* emphasis. Search engines show it verbatim, so the markers
    // are stripped for the structured copy only; the page itself is untouched.
    ...(event.description ? { description: plainDescription(event.description) } : {}),
    ...(hasFlyer ? { image: [event.flyer_url] } : {}),
    location: {
      '@type': 'Place',
      name: event.venue || event.location || 'Dubai, UAE',
      address: event.location || 'Dubai, United Arab Emirates',
      ...(event.google_maps_url ? { hasMap: event.google_maps_url } : {}),
    },
    organizer: { '@type': 'Organization', name: 'BILD', url: SITE_URL },
    performer: { '@type': 'Organization', name: 'BILD' },
    ...(offers.length ? { offers } : {}),
  }

  return (
    <div className="py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
        />
        <Link href="/events" className="inline-flex items-center gap-2 text-charcoal-600 hover:text-gold-600 mb-8 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Events
        </Link>

        <div className="rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-charcoal-700 to-charcoal-900">
          {hasFlyer ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.flyer_url!} alt={event.title} className="w-full max-h-[520px] object-contain bg-charcoal-900" />
          ) : (
            <div className="h-64 flex items-center justify-center">
              <span className="font-display text-white/10 text-8xl font-bold">BILD</span>
            </div>
          )}
        </div>

        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {event.tags.map(tag => (
              <span key={tag} className="bg-gold-100 text-gold-700 text-xs font-medium px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        <h1 className="font-display text-3xl md:text-4xl font-bold text-charcoal-800 mb-6">{event.title}</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 p-6 bg-gold-50 rounded-xl">
          <div className="flex items-start gap-3">
            <Calendar size={18} className="text-gold-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-charcoal-500 font-medium uppercase tracking-wide">Date</p>
              <p className="text-sm text-charcoal-800 font-semibold">{formatEventDate(event.event_date)}</p>
              <p className="text-sm text-charcoal-600">{formatEventTime(event.event_date)}</p>
            </div>
          </div>
          {(event.venue || event.location) && (
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-gold-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-charcoal-500 font-medium uppercase tracking-wide">Venue</p>
                {event.venue && <p className="text-sm text-charcoal-800 font-semibold">{event.venue}</p>}
                {event.location && <p className="text-sm text-charcoal-600">{event.location}</p>}
                {event.google_maps_url && (
                  <a href={event.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-gold-600 hover:underline mt-1">
                    View on Google Maps
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {!isPast && <AddToCalendar event={event} />}

        {event.description && (
          <div className="prose prose-lg text-charcoal-700 mb-10 whitespace-pre-line">
            {event.description}
          </div>
        )}

        {!isPast && (
          <EventRegistration event={{ id: event.id, slug: event.slug, title: event.title }} tickets={tickets} soldOut={remaining != null && remaining <= 0} waitlistOpen={event.waitlist_open !== false} dietaryRequired={event.dietary_required} />
        )}

        {isPast && gallery.length > 0 && <EventGallery items={gallery} />}

        {isPast && gallery.length === 0 && (
          <p className="text-charcoal-500 text-sm">This event has finished. Photos and videos will be added soon.</p>
        )}
      </div>
    </div>
  )
}
