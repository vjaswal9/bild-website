import HeroPhoto from '@/components/home/HeroPhoto'
import { HERO_PHOTOS } from '@/lib/hero-photos'
import WhyJoin from '@/components/home/WhyJoin'
import MissionStatement from '@/components/home/MissionStatement'
import FounderMessage from '@/components/home/FounderMessage'
import CommunityStats from '@/components/home/CommunityStats'
import TwoJourneys from '@/components/home/TwoJourneys'
import FindYourPeople from '@/components/home/FindYourPeople'
import DirectoryPromo from '@/components/home/DirectoryPromo'
import HighlightCards from '@/components/home/HighlightCards'
import GoogleReviews from '@/components/home/GoogleReviews'
import JoinCTA from '@/components/home/JoinCTA'
import EventCard from '@/components/events/EventCard'
import SectionHeading from '@/components/ui/SectionHeading'
import FAQSection from '@/components/ui/FAQSection'
import Link from 'next/link'
import Reveal from '@/components/anim/Reveal'
import { btnOutline } from '@/lib/ui'
import { getPublishedEvents } from '@/lib/events-server'
import { isPastEvent } from '@/lib/events'
import { LAUNCH_MODE } from '@/lib/launch'
import { ELIGIBILITY_SUMMARY } from '@/lib/eligibility'
import { getGoogleReviews } from '@/lib/google-reviews'

// Rebuilt on a timer rather than on every request. Rendering per-request meant
// every visitor waited on the events query before a single byte was sent, which
// measured ~1.5s to first byte against ~0.15s for the static pages. The events
// list changes a few times a month, so a five-minute window costs nothing in
// freshness and removes the round trip from the critical path entirely.
//
// Fetch-level caching is still deliberately NOT forced off here:
// `fetchCache = 'force-no-store'` would override the 24h cache
// getGoogleReviews() sets on its Places API call.
export const revalidate = 300

export default async function Home() {
  // Fetched together rather than one after the other - they don't depend on
  // each other, so running them in sequence just added their latencies up.
  const [allEvents, googleReviews] = await Promise.all([
    getPublishedEvents(),
    getGoogleReviews(),
  ])
  const upcomingEvents = allEvents.filter(e => !isPastEvent(e)).slice(0, 3)

  return (
    <>
      {/* The page follows the questions a stranger actually asks, in order:
          what is this, what do you want from me, is it real, is it for me,
          what do I get, do others rate it, when can I come, I have a business,
          what will it feel like, who is behind it, practical questions, right
          then.

          Two deliberate moves. The numbers sit third rather than seventh,
          because scepticism has to be answered before anything is sold. And
          the founder's message sits near the end rather than third: it is the
          emotional close, and a visitor three sections in has no reason yet to
          care who wrote it. */}
      <HeroPhoto
        images={HERO_PHOTOS}
        googleRating={googleReviews ? { rating: googleReviews.rating, totalReviews: googleReviews.totalReviews, mapsUrl: googleReviews.mapsUrl } : null}
        nextEvent={upcomingEvents[0]
          ? { title: upcomingEvents[0].title, date: upcomingEvents[0].event_date, slug: upcomingEvents[0].slug }
          : null}
      />
      <TwoJourneys />
      <CommunityStats />
      <MissionStatement />
      <WhyJoin />
      <Reveal><GoogleReviews /></Reveal>
      {!LAUNCH_MODE && <Reveal><HighlightCards /></Reveal>}

      {upcomingEvents.length > 0 && (
        <section className="py-20 bg-stone-100 border-y border-stone-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <SectionHeading
                title="Upcoming Events"
                subtitle="Join us at our next BILD gathering"
              />
            </Reveal>
            <Reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" stagger={0.15} y={36}>
              {upcomingEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </Reveal>
            <div className="text-center mt-10">
              <Link href="/events" className={`${btnOutline} px-6 py-3`}>
                See All Events
              </Link>
            </div>
          </div>
        </section>
      )}

      <DirectoryPromo />
      <FindYourPeople />
      <FounderMessage />

      <section className="py-20 bg-stone-100 border-y border-stone-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading title="Frequently Asked Questions" subtitle="Everything you need to know about BILD" />
          </Reveal>
          <Reveal>
            <FAQSection
              faqs={[
                {
                  q: 'What is BILD?',
                  a: 'BILD (British Indians Living in Dubai) is a membership network for people of British Indian heritage living in the UAE, connecting members through cultural celebrations, social events, business networking, and a private community.',
                },
                {
                  q: 'Who can join BILD?',
                  a: ELIGIBILITY_SUMMARY,
                },
                {
                  q: 'Is BILD only for Dubai residents?',
                  a: 'BILD is based in Dubai and most active there, but membership and events are open to British Indians living anywhere in the UAE.',
                },
                {
                  q: 'How do I get involved?',
                  a: 'Join BILD to get access to events, WhatsApp community groups, and the Business Directory. You can apply on our Join page, where the membership fee is shown before you pay.',
                },
                {
                  q: 'Does BILD have a business directory?',
                  a: 'Yes - the BILD Business Directory lists British Indian businesses and professionals across the UAE and UK, open to both BILD members and non-members.',
                },
              ]}
            />
          </Reveal>
        </div>
      </section>

      <Reveal><JoinCTA /></Reveal>
    </>
  )
}
