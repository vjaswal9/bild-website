import type { Metadata } from 'next'
import PageHero from '@/components/ui/PageHero'

export const metadata: Metadata = { title: 'About BILD' }

export default function AboutPage() {
  return (
    <>
      <PageHero title="About BILD" subtitle="Our story, mission and values" />
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article className="prose prose-lg prose-charcoal max-w-none">
            <h2>Who We Are</h2>
            <p>
              BILD (British Indians Living in Dubai) is a not-for-profit community created exclusively for individuals
              of British Indian heritage, or those married to someone who is, living in the UAE. We welcome those of
              Indian origin who were born or raised in the UK and identify with both British and Indian culture.
            </p>

            <h2>Our Mission</h2>
            <p>
              BILD was founded on a simple belief: that the shared experience of being British and Indian, and living
              far from both home countries, creates a unique and powerful bond. We exist to nurture that bond, to help
              British Indians in Dubai find their community, celebrate their dual heritage, and support one another.
            </p>

            <h2>What We Do</h2>
            <p>BILD connects members through:</p>
            <ul>
              <li>
                <strong>Cultural celebrations</strong>: Diwali, Holi, and other festivals celebrated in true
                British-Indian style
              </li>
              <li>
                <strong>Social meet-ups</strong>: relaxed, informal gatherings for members and their families
              </li>
              <li>
                <strong>Family-friendly activities</strong>: events designed for the whole family to enjoy together
              </li>
              <li>
                <strong>Business networking</strong>: opportunities to support and grow British Indian businesses,
                professionals, and entrepreneurs in the UAE
              </li>
            </ul>

            <h2>Our Values</h2>
            <p>
              While we embrace all faiths, BILD remains centred on the unique experiences of British Indians living
              abroad. We are proud of both our British and Indian heritage, and we believe that celebrating both makes
              our community stronger.
            </p>
            <p>
              We are welcoming, inclusive, and family-oriented. We support one another in business and in life. And
              above all, we are proud to call ourselves British Indians.
            </p>

            <h2>Membership Eligibility</h2>
            <p>BILD membership is open to:</p>
            <ul>
              <li>Individuals of Indian origin who were born or raised in the United Kingdom</li>
              <li>Those who identify with both British and Indian culture</li>
              <li>Spouses or partners of British Indians who meet the above criteria</li>
              <li>All faiths and backgrounds within the British Indian community</li>
            </ul>
            <p>Members must currently be residing in the UAE.</p>
          </article>
        </div>
      </div>
    </>
  )
}
