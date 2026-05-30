import type { Metadata } from 'next'
import SectionHeading from '@/components/ui/SectionHeading'

export const metadata: Metadata = { title: 'Terms & Conditions' }

export default function TermsPage() {
  return (
    <div className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Terms & Conditions" subtitle="Please read these terms carefully before joining BILD" />

        <article className="prose prose-lg prose-charcoal max-w-none">
          <p className="text-sm text-charcoal-500">Last updated: January 2025</p>

          <h2>1. About BILD</h2>
          <p>
            BILD (British Indians Living in Dubai) is a not-for-profit community organisation operating in the United
            Arab Emirates. References to &ldquo;BILD&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo; in these Terms refer to the BILD community and
            its organising committee.
          </p>

          <h2>2. Membership</h2>
          <p>
            By joining BILD and paying the membership fee, you confirm that you meet the eligibility criteria as
            set out in our Community Rules and agree to be bound by these Terms and Conditions.
          </p>
          <p>Membership is a lifetime fee: a single one-off payment. Membership fees are non-refundable.</p>

          <h2>3. Membership Fees & Payments</h2>
          <ul>
            <li>The current lifetime membership fee is 50 AED: a one-off payment.</li>
            <li>Membership fees are non-refundable unless a payment error has occurred.</li>
            <li>BILD reserves the right to change the membership fee with reasonable notice to members.</li>
          </ul>

          <h2>4. Events</h2>
          <ul>
            <li>Event tickets are non-refundable unless the event is cancelled by BILD.</li>
            <li>In the event of cancellation, BILD will offer a refund or credit towards a future event.</li>
            <li>BILD reserves the right to refuse entry to any event.</li>
            <li>BILD is not responsible for personal injury, loss, or damage arising from attendance at events.</li>
          </ul>

          <h2>5. Business Directory</h2>
          <p>
            The BILD Business Directory is provided as a service to members. BILD does not endorse, verify, or
            guarantee the quality of any business or service listed in the directory. Members engage with listed
            businesses at their own risk. BILD accepts no liability for any loss or dispute arising from transactions
            between members and listed businesses.
          </p>

          <h2>6. Photography & Media</h2>
          <p>
            By attending BILD events, you acknowledge that photographs and videos may be taken and used for BILD
            community purposes, including on this website and social media. If you do not wish to be photographed,
            please inform the organiser at the event.
          </p>

          <h2>7. Privacy & Data</h2>
          <p>
            BILD collects and processes personal data necessary to manage your membership and keep you informed
            about events and community news. We will never sell your data to third parties. By joining BILD, you
            consent to receiving community communications. You may opt out at any time by contacting us.
          </p>

          <h2>8. Liability</h2>
          <p>
            BILD is a volunteer-run, not-for-profit community organisation. To the fullest extent permitted by law,
            BILD and its committee members accept no liability for any loss, damage, or injury arising from
            membership, attendance at events, or use of this website.
          </p>

          <h2>9. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the United Arab Emirates. Any disputes shall be subject to
            the exclusive jurisdiction of the courts of Dubai.
          </p>

          <h2>10. Changes to These Terms</h2>
          <p>
            BILD may update these Terms from time to time. Continued membership following an update constitutes
            acceptance of the revised Terms. We will notify members of material changes.
          </p>

          <h2>Contact</h2>
          <p>
            For any questions regarding these Terms, please contact us at{' '}
            <a href="mailto:connect@bild.ae" className="text-saffron-600">connect@bild.ae</a>.
          </p>
        </article>
      </div>
    </div>
  )
}
