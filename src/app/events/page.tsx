import type { Metadata } from 'next'
import Image from 'next/image'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import EventCard from '@/components/events/EventCard'
import Reveal from '@/components/anim/Reveal'
import { getPublishedEvents, getRemainingCapacities } from '@/lib/events-server'
import { isPastEvent } from '@/lib/events'
import { PAST_EVENTS_PUBLISHED } from '@/lib/launch'
import { getGoogleReviews } from '@/lib/google-reviews'

export const metadata: Metadata = {
  title: 'Events',
  description: 'Upcoming BILD events for British Indians in Dubai and the UAE - festivals and celebrations, socials, networking and family-friendly gatherings.',
}
// Rebuilt every fifteen minutes rather than per request: the events list is the
// same for every visitor and changes a few times a month, so there is nothing
// to gain from querying it again for each one. Admin edits refresh it at once
// (see revalidatePublic); the timer only covers an event ending, or selling out.
export const revalidate = 900

export default async function EventsPage() {
  const events = await getPublishedEvents()
  const upcoming = events.filter(e => !isPastEvent(e))
  // Most recent first for past events
  // Past events can be switched off (PAST_EVENTS_PUBLISHED in src/lib/launch.ts).
  const past = PAST_EVENTS_PUBLISHED ? events.filter(e => isPastEvent(e)).reverse() : []
  const [googleReviews, remaining] = await Promise.all([
    getGoogleReviews(),
    getRemainingCapacities(upcoming),
  ])

  return (
    <>
      <PageHero title="Events" subtitle="Celebrate, connect, and grow with the BILD family">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-12">
            <p className="text-sm font-semibold text-charcoal-700">BILD official ticketing partner:</p>
            <Image src="/images/partners/ticketsfy.webp" alt="Ticketsfy" width={1623} height={327} className="h-7 w-auto" />
          </div>
          {upcoming.length > 0 && (
            <section className="mb-16">
              <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-8">Upcoming Events</h2>
              <Reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" stagger={0.12} y={36}>
                {upcoming.map(event => (
                  <EventCard key={event.id} event={event} soldOut={remaining[event.id] === 0} />
                ))}
              </Reveal>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-8">Past Events</h2>
              <Reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" stagger={0.1} y={36}>
                {past.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </Reveal>
            </section>
          )}

          {upcoming.length === 0 && past.length === 0 && (
            <p className="text-center text-charcoal-600 py-16">No events at the moment. Check back soon!</p>
          )}

          {/* Events have their own inbox, so a ticket question does not queue
              behind general enquiries. */}
          <p className="mt-14 text-center text-sm text-charcoal-600">
            Questions about a booking, a waitlist or a ticket transfer? Email{' '}
            <a href="mailto:events@bild.ae" className="text-gold-600 font-semibold hover:underline">events@bild.ae</a>
          </p>
        </div>
      </div>
    </>
  )
}
