import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/data/config'
import Link from 'next/link'
import { ELIGIBILITY_CRITERIA, ELIGIBILITY_RESIDENCY } from '@/lib/eligibility'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import Reveal from '@/components/anim/Reveal'
import FounderMessage from '@/components/home/FounderMessage'
import Milestones from '@/components/about/Milestones'
import { getGoogleReviews } from '@/lib/google-reviews'
import { btnPrimary } from '@/lib/ui'

// Regenerated on the same timer as every other page that shows the Google
// rating badge. Left fully static, these pages froze their review count at
// deploy time while the homepage moved on, so two pages could show a
// different number of reviews on the same day.
export const revalidate = 300

export const metadata: Metadata = {
  // Just 'About': the title template already appends '| BILD'.
  title: 'About',
  description:
    `The story of BILD (British Indians Living in Dubai): founded in Dubai in 2019 by Truna Jaswal, now 2,000+ members, ${SITE_CONFIG.whatsappCommunities} community groups and over 100 events. A licensed UAE business.`,
}

// The figures the story rests on. Kept together so they cannot drift apart
// across the paragraphs that quote them.
const facts = [
  { value: '2019', label: 'Founded in Dubai' },
  { value: '2,000+', label: 'Members across the UAE' },
  { value: String(SITE_CONFIG.whatsappCommunities), label: 'Specialist community groups' },
  { value: '100+', label: 'Events hosted since 2019' },
]

export default async function AboutPage() {
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="About BILD" subtitle="Our story, mission and values">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>

      {/* ---- The story ---- */}
      <section className="py-16 bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <span className="text-gold-500 font-semibold text-sm uppercase tracking-widest">Our story</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal-800 mt-3 mb-6">
              It started because moving to Dubai is easy, and belonging in it is not
            </h2>
          </Reveal>
          <Reveal className="space-y-5 text-lg text-charcoal-600 leading-relaxed" stagger={0.08} y={18}>
            <p>
              BILD was founded in Dubai in 2019 by <strong className="text-charcoal-800">Truna Jaswal</strong>. The
              idea was a simple one, and it came from experience: plenty of British Indians arrive in the UAE with a
              job, a flat and a plan, and almost nobody to call on a Sunday.
            </p>
            <p>
              Being British Indian abroad is its own particular thing. You grew up between two cultures and you are
              now living in a third. It is a specific experience, and it is much easier alongside people who do not
              need it explained to them.
            </p>
            <p>
              What began as a few people meeting up and one group chat has grown into a network of{' '}
              <strong className="text-charcoal-800">more than 2,000 members</strong>, {SITE_CONFIG.whatsappCommunities} specialist community groups
              and over a hundred events. It is now a licensed Dubai business, and it is still run on the same
              principle it started on: bring people together, and the rest follows.
            </p>
          </Reveal>

          {/* ---- The numbers, as evidence rather than decoration ---- */}
          <Reveal className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gold-200 border border-gold-200 mt-12" stagger={0.08} y={16}>
            {facts.map(f => (
              <div key={f.label} className="bg-cream px-4 py-6 text-center">
                <p className="font-display text-3xl font-bold text-gold-600 leading-none">{f.value}</p>
                <p className="text-charcoal-500 text-xs mt-2 leading-snug">{f.label}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ---- Timeline ---- */}
      <Milestones />

      {/* ---- Founder, in her own words ---- */}
      <FounderMessage />

      {/* ---- What BILD does now ---- */}
      <section className="py-16 bg-cream border-t border-gold-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <article className="prose prose-lg prose-charcoal max-w-none">
              <h2>What we do</h2>
              <p>
                BILD runs a calendar of events across Dubai and the wider UAE, alongside the community groups where
                most of the day-to-day life of BILD actually happens.
              </p>
              <ul>
                <li>
                  <strong>Cultural celebrations</strong>: Diwali, Garba and the festivals that matter, celebrated in
                  true British Indian style. Recent nights have been held at Al Habtoor Polo Resort and the Radisson
                  in Barsha.
                </li>
                <li>
                  <strong>Social meet-ups</strong>: ladies nights, lads brunches and coffee mornings, from the
                  Observatory Lounge in Dubai Marina to Arabian Ranches Golf Club.
                </li>
                <li>
                  <strong>Family-friendly days</strong>: beach walks at Kite Beach and events built for everyone from
                  grandparents to toddlers.
                </li>
                <li>
                  <strong>Specialist groups</strong>: {SITE_CONFIG.whatsappCommunities} of them, covering schools and parenting, property, food,
                  business, buying and selling, book clubs, walking, padel and golf.
                </li>
                <li>
                  <strong>The Business Directory</strong>: British Indian businesses and professionals across the UAE
                  and UK, open to members and non-members alike.{' '}
                  <Link href="/directory">Browse the directory</Link>.
                </li>
              </ul>

              <h2>Our values</h2>
              <p>
                While we embrace all faiths, BILD remains centred on the unique experiences of British Indians living
                abroad. We are proud of both our British and Indian heritage, and we believe that celebrating both
                makes our community stronger.
              </p>
              <p>
                We are welcoming, inclusive, and family-oriented. We support one another in business and in life. And
                above all, we are proud to call ourselves British Indians.
              </p>

              <h2>Who can join</h2>
              <p>BILD membership is open to:</p>
              <ul>
                {ELIGIBILITY_CRITERIA.map(c => <li key={c}>{c}</li>)}
              </ul>
              <p>{ELIGIBILITY_RESIDENCY}</p>

              <h2>A licensed business, not a group chat</h2>
              <p>
                BILD operates as <strong>B.I.L.D AE Events Organizing &amp; Managing</strong>, licensed by the Dubai
                Department of Economy and Tourism. Membership fees, event tickets and directory listings fund the
                running of BILD: its operating costs, licensing, administration and the events themselves.
              </p>
              <p>
                How we handle your information is set out in our <Link href="/privacy">Privacy Policy</Link>, refunds
                in our <Link href="/refund-policy">Refund Policy</Link>, and the rules of membership in our{' '}
                <Link href="/terms">Terms and Conditions</Link>. You can reach us any time at{' '}
                <a href="mailto:connect@bild.ae">connect@bild.ae</a>.
              </p>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ---- Both journeys, matching the homepage ---- */}
      <section className="py-16 bg-charcoal-800">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            Come and find your people
          </h2>
          <p className="text-gray-300 text-lg mb-8">
            Join as a member, or put your business in front of the community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/join" className={`${btnPrimary} px-8 py-3.5 text-base`}>
              Join BILD ⭐
            </Link>
            <Link href="/directory/submit" className={`${btnPrimary} px-8 py-3.5 text-base`}>
              List Your Business
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
