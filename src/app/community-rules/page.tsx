import type { Metadata } from 'next'
import SectionHeading from '@/components/ui/SectionHeading'

export const metadata: Metadata = { title: 'Community Rules' }

export default function CommunityRulesPage() {
  return (
    <div className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Community Rules" subtitle="Our guidelines for a welcoming and respectful community" />

        <article className="prose prose-lg prose-charcoal max-w-none">
          <p className="lead">
            BILD is built on mutual respect, shared heritage, and a desire to connect. These community rules exist
            to ensure that BILD remains a safe, welcoming, and positive space for all members.
          </p>

          <h2>1. Eligibility & Membership</h2>
          <ul>
            <li>Membership is open to individuals of Indian origin who were born or raised in the United Kingdom and are living in the UAE.</li>
            <li>Spouses and partners of eligible members are also welcome.</li>
            <li>Membership is personal and non-transferable.</li>
            <li>BILD reserves the right to decline or revoke membership at its discretion.</li>
          </ul>

          <h2>2. Respect & Conduct</h2>
          <ul>
            <li>Treat all members with respect, regardless of background, faith, age, or gender.</li>
            <li>Discrimination, harassment, bullying, or abuse of any kind will not be tolerated and will result in immediate removal from the community.</li>
            <li>Disagreements must be handled privately and respectfully. Public arguments are not permitted in BILD channels.</li>
            <li>Personal attacks, offensive language, or demeaning comments are strictly prohibited.</li>
          </ul>

          <h2>3. Communications & Social Media</h2>
          <ul>
            <li>BILD WhatsApp and social media groups are for community-related content only.</li>
            <li>Excessive promotional messages, spam, or unrelated forwarded content is not permitted.</li>
            <li>Members may share their business details once per month in the designated business channel.</li>
            <li>Political, religious, or controversial content that could cause division is not permitted.</li>
            <li>Photos and videos of other members must not be shared publicly without their explicit consent.</li>
          </ul>

          <h2>4. Events</h2>
          <ul>
            <li>All members are expected to behave respectfully at BILD events.</li>
            <li>BILD events are family-friendly unless explicitly stated otherwise.</li>
            <li>Tickets purchased for events are non-refundable unless the event is cancelled by BILD.</li>
            <li>Members who behave disruptively at events may be asked to leave and may have their membership revoked.</li>
          </ul>

          <h2>5. Business Directory</h2>
          <ul>
            <li>Only current BILD members may list businesses in the directory.</li>
            <li>Business listings must be accurate and up to date.</li>
            <li>BILD does not endorse or take responsibility for the services listed in the directory.</li>
            <li>Misleading or fraudulent business listings will result in removal and potential membership revocation.</li>
          </ul>

          <h2>6. Privacy</h2>
          <ul>
            <li>Member contact details shared within BILD must not be shared with third parties without consent.</li>
            <li>BILD will never sell member data to third parties.</li>
            <li>Members should respect the privacy of other members at all times.</li>
          </ul>

          <h2>7. Amendments</h2>
          <p>
            BILD reserves the right to amend these community rules at any time. Members will be notified of any
            material changes. Continued membership following an amendment constitutes acceptance of the updated rules.
          </p>

          <h2>8. Enforcement</h2>
          <p>
            Breaches of these rules will be handled by the BILD committee. Depending on the severity, consequences
            may include a warning, temporary suspension, or permanent removal from the community. Decisions made
            by the BILD committee are final.
          </p>

          <p className="text-sm text-charcoal-500">
            Questions about these rules? Contact us at{' '}
            <a href="mailto:hello@bild.ae" className="text-saffron-600">hello@bild.ae</a>.
          </p>
        </article>
      </div>
    </div>
  )
}
