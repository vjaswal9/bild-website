import Hero from '@/components/home/Hero'
import MissionStatement from '@/components/home/MissionStatement'
import FounderMessage from '@/components/home/FounderMessage'
import HighlightCards from '@/components/home/HighlightCards'
import JoinCTA from '@/components/home/JoinCTA'
import EventCard from '@/components/events/EventCard'
import SectionHeading from '@/components/ui/SectionHeading'
import Link from 'next/link'
import eventsData from '@/data/events.json'
import { BildEvent } from '@/lib/types'

export default function Home() {
  const upcomingEvents = eventsData.events.filter(e => e.status === 'upcoming').slice(0, 3)

  return (
    <>
      <Hero />
      <MissionStatement />
      <FounderMessage />
      <HighlightCards />

      {upcomingEvents.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeading
              title="Upcoming Events"
              subtitle="Join us at our next BILD gathering"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {upcomingEvents.map(event => (
                <EventCard key={event.id} event={event as BildEvent} />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                href="/events"
                className="inline-block border-2 border-charcoal-700 text-charcoal-700 px-6 py-3 rounded-lg font-semibold hover:bg-charcoal-700 hover:text-white transition-all"
              >
                See All Events
              </Link>
            </div>
          </div>
        </section>
      )}

      <JoinCTA />
    </>
  )
}
