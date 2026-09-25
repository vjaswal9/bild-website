import type { Metadata } from 'next'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import { getGoogleReviews } from '@/lib/google-reviews'

// Regenerated on the same timer as every other page that shows the Google
// rating badge. Left fully static, these pages froze their review count at
// deploy time while the homepage moved on, so two pages could show a
// different number of reviews on the same day.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Refund Policy',
  description:
    'BILD\'s refund policy for membership fees, event tickets, Business Directory listings and Featured placements, including what happens if an event is cancelled or rescheduled.',
}

const LAST_UPDATED = '9 September 2026'

export default async function RefundPolicyPage() {
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="Refund Policy" subtitle="When BILD gives a refund, and how to ask for one">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>

      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article className="prose prose-lg prose-charcoal max-w-none">
            <p className="lead">
              This Refund Policy sets out when BILD (British Indians Living in Dubai) will and will not give a refund.
              It covers the membership fee, event tickets, Business Directory listings and Featured placements. This
              policy governs refunds, and where BILD&rsquo;s <a href="/terms">Terms and Conditions</a> say anything
              different about refunds, this policy prevails.
            </p>
            <p>
              <strong>Last updated:</strong> {LAST_UPDATED}
            </p>

            <h2>1. Membership fee</h2>
            <ul>
              <li>The BILD membership fee is a one-time fee and is <strong>non-refundable once paid</strong>.</li>
              <li>
                If your application is declined by BILD after you have paid, the membership fee is refunded in full.
              </li>
              <li>
                If your membership is suspended or terminated because you have breached the Terms and Conditions or
                the Community Rules, the membership fee is not refunded.
              </li>
              <li>
                If you choose to leave BILD, or ask for your data to be deleted, the membership fee is not refunded.
              </li>
              <li>
                If you were charged more than once for the same membership in error, the duplicate charge is refunded
                in full.
              </li>
            </ul>

            <h2>2. Event tickets</h2>

            <h3>2.1 If you cannot attend</h3>
            <p>
              Event tickets are <strong>non-refundable</strong>. BILD commits to venues, catering and suppliers in
              advance on the basis of tickets sold, and those costs cannot be recovered once committed.
            </p>
            <p>
              You may transfer your ticket to another person who is eligible to attend, at no charge, provided you
              email <a href="mailto:events@bild.ae">events@bild.ae</a> with the new attendee&rsquo;s name at least
              48 hours before the event starts. Tickets may not be resold for more than you paid.
            </p>

            <h3>2.2 If BILD cancels the event</h3>
            <p>
              If BILD cancels an event, you will be offered a <strong>full refund of the ticket price, or a credit
              towards a future BILD event</strong>, at your choice. Refunds are issued to the original payment method.
            </p>

            <h3>2.3 If BILD reschedules the event</h3>
            <p>
              If BILD moves an event to a different date, your ticket is automatically valid for the new date. If you
              cannot attend the new date, tell us within 7 days of the change being announced and you will be offered
              a full refund or a credit.
            </p>

            <h3>2.4 If an event is cut short or changed</h3>
            <p>
              If an event goes ahead but part of it does not, for example a performer withdraws or a venue restricts
              access, BILD may offer a partial refund or credit at its discretion. A change to the programme, the
              venue within the same emirate, or the running order does not by itself create a right to a refund.
            </p>

            <h3>2.5 If you are refused entry or removed</h3>
            <p>
              No refund is given where you are refused entry to, or removed from, an event because of your conduct,
              because you cannot prove your identity or membership, or because you breached the Terms and Conditions
              or the Community Rules.
            </p>

            <h3>2.6 Circumstances beyond BILD&rsquo;s control</h3>
            <p>
              Where an event cannot go ahead for reasons outside BILD&rsquo;s reasonable control, including severe
              weather, government restrictions, venue closure or a public emergency, BILD will offer a credit towards
              a future event. Where BILD is able to recover its own costs, it will offer a refund of the amount
              recovered instead.
            </p>

            <h2>3. Business Directory listings</h2>
            <ul>
              <li>
                Submitting a listing for review is free. Payment is only requested once your listing has been
                approved.
              </li>
              <li>
                Listing fees are <strong>non-refundable</strong>, including for the unused part of a listing period,
                and including where you choose to remove your listing before it expires.
              </li>
              <li>
                If your listing is removed by BILD because you breached the Terms and Conditions, no refund is given.
              </li>
              <li>
                If BILD removes or suspends your listing for a reason that is not your fault, you will be refunded on
                a pro-rata basis for the unused part of the period.
              </li>
              <li>
                If you pay a listing fee and your listing is then not approved, the fee is refunded in full.
              </li>
            </ul>

            <h2>4. Featured placements</h2>
            <ul>
              <li>
                Featured placement is bought in three-month periods and is <strong>non-refundable</strong>, including
                for the unused part of a period.
              </li>
              <li>
                If BILD is unable to provide Featured placement for a substantial part of the period you paid for, you
                will be offered a pro-rata refund or an extension of the period, at BILD&rsquo;s discretion.
              </li>
              <li>
                Featured placement gives your business greater visibility. It is not a guarantee of enquiries,
                customers or revenue, and no refund is given because a placement did not produce the results you
                hoped for.
              </li>
            </ul>

            <h2>5. Disputes between members and listed businesses</h2>
            <p>
              BILD lists businesses. It does not sell their goods or services, is not a party to any contract between
              a member and a listed business, and cannot compel a listed business to give a refund. Any refund for
              goods or services bought from a listed business is a matter between you and that business.
            </p>

            <h2>6. Duplicate and incorrect charges</h2>
            <p>
              If you are charged twice for the same thing, or charged the wrong amount, tell us and we will refund the
              difference in full. Please contact us within 60 days of the charge.
            </p>

            <h2>7. Card processing fees</h2>
            <p>
              Where a third party card processing fee was added at checkout and shown separately on your confirmation,
              that fee is refunded together with the ticket price whenever BILD gives a full refund, for example when
              BILD cancels an event. It is not refunded on a partial refund or a credit.
            </p>

            <h2>8. How to request a refund</h2>
            <p>
              For an event ticket, email <a href="mailto:events@bild.ae">events@bild.ae</a>. For membership, a
              directory listing or Featured placement, email{' '}
              <a href="mailto:connect@bild.ae">connect@bild.ae</a>. Include your name, the email address you used to
              pay, what you paid for, and the date. Please include your Stripe receipt or confirmation email if you
              have it.
            </p>
            <ul>
              <li>We will acknowledge your request within 5 working days.</li>
              <li>Approved refunds are issued to the original payment method.</li>
              <li>
                Refunds normally reach your account within 5 to 10 working days, depending on your bank or card
                issuer. BILD does not control that timing.
              </li>
              <li>BILD cannot refund to a different card, account or person.</li>
            </ul>

            <h2>9. Your statutory rights</h2>
            <p>
              Nothing in this policy removes any right you have under UAE consumer protection law. Where the law gives
              you a stronger right than this policy does, the law applies.
            </p>

            <h2>10. Changes to this policy</h2>
            <p>
              BILD may update this policy from time to time. The version that applies to your purchase is the one
              published on this page at the time you paid.
            </p>

            <p>
              This policy should be read together with BILD&rsquo;s <a href="/terms">Terms and Conditions</a> and its{' '}
              <a href="/privacy">Privacy Policy</a>.
            </p>
          </article>
        </div>
      </div>
    </>
  )
}
