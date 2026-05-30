import type { Metadata } from 'next'
import PageHero from '@/components/ui/PageHero'
import EventCard from '@/components/events/EventCard'
import eventsData from '@/data/events.json'
import { BildEvent } from '@/lib/types'

export const metadata: Metadata = { title: 'Events' }

export default function EventsPage() {
  const upcoming = eventsData.events.filter(e => e.status === 'upcoming') as BildEvent[]
  const past = eventsData.events.filter(e => e.status === 'past') as BildEvent[]

  return (
    <>
      <PageHero title="Events" subtitle="Celebrate, connect, and grow with the BILD community" />
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {upcoming.length > 0 && (
            <section className="mb-16">
              <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-8">Upcoming Events</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {upcoming.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-8">Past Events</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {past.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {upcoming.length === 0 && past.length === 0 && (
            <p className="text-center text-charcoal-600 py-16">No events at the moment. Check back soon!</p>
          )}
        </div>
      </div>
    </>
  )
}
