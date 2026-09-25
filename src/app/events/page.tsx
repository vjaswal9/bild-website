import type { Metadata } from 'next'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import EventCard from '@/components/events/EventCard'
import Reveal from '@/components/anim/Reveal'
import { getPublishedEvents } from '@/lib/events-server'
import { isPastEvent } from '@/lib/events'
import { getGoogleReviews } from '@/lib/google-reviews'

export const metadata: Metadata = {
  title: 'Events',
  description: 'Upcoming BILD events for British Indians in Dubai and the UAE - cultural celebrations, socials, networking and family-friendly gatherings.',
}
// Rebuilt every five minutes rather than per request: the events list is the
// same for every visitor and changes a few times a month, so there is nothing
// to gain from querying it again for each one.
export const revalidate = 300

export default async function EventsPage() {
  const events = await getPublishedEvents()
  const upcoming = events.filter(e => !isPastEvent(e))
  // Most recent first for past events
  const past = events.filter(e => isPastEvent(e)).reverse()
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="Events" subtitle="Celebrate, connect, and grow with the BILD community">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {upcoming.length > 0 && (
            <section className="mb-16">
              <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-8">Upcoming Events</h2>
              <Reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" stagger={0.12} y={36}>
                {upcoming.map(event => (
                  <EventCard key={event.id} event={event} />
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
          <p className="mt-14 text-center text-sm text-charcoal-500">
            Questions about a booking, a waitlist or a ticket transfer? Email{' '}
            <a href="mailto:events@bild.ae" className="text-gold-600 font-semibold hover:underline">events@bild.ae</a>
          </p>
        </div>
      </div>
    </>
  )
}
