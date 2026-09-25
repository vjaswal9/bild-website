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
  title: 'Privacy Policy',
  description:
    'How BILD collects, uses, stores and protects personal information from membership applications, events, the Business Directory, WhatsApp groups and this website.',
}

const LAST_UPDATED = '9 September 2026'

export default async function PrivacyPolicyPage() {
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="Privacy Policy" subtitle="How BILD collects, uses and protects your personal information">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>

      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article className="prose prose-lg prose-charcoal max-w-none">
            <p className="lead">
              This Privacy Policy explains what personal information BILD (British Indians Living in Dubai) collects,
              why we collect it, who we share it with, how long we keep it, and the choices you have. It applies to
              this website, to BILD membership, to BILD events, to the BILD Business Directory, and to the BILD
              WhatsApp and social media communities.
            </p>
            <p>
              <strong>Last updated:</strong> {LAST_UPDATED}
            </p>

            <h2>1. Who we are</h2>
            <p>
              BILD is operated by B.I.L.D AE Events Organizing &amp; Managing, licensed by the Dubai Department of
              Economy &amp; Tourism. For anything relating to this policy or your
              personal information, contact us at <a href="mailto:connect@bild.ae">connect@bild.ae</a>. This is the
              only email address BILD uses for privacy and data protection requests.
            </p>

            <h2>2. Information we collect</h2>

            <h3>2.1 Membership applications</h3>
            <p>When you apply to join BILD we ask for:</p>
            <ul>
              <li>your full name, email address, UAE mobile number and WhatsApp number;</li>
              <li>the emirate you live in, and the date you moved to the UAE;</li>
              <li>your gender and year of birth;</li>
              <li>your marital status, and your partner&rsquo;s name and mobile number where you give them;</li>
              <li>whether you have children, and their ages, so we can plan family-friendly events;</li>
              <li>your religion, which is optional and used only to plan cultural and religious celebrations;</li>
              <li>the city you are from in the UK and, where relevant, in India;</li>
              <li>your company name, job title, industry and business type, for professional networking;</li>
              <li>your LinkedIn and Instagram handles, where you give them;</li>
              <li>how you heard about BILD, and the name and mobile number of the member who referred you;</li>
              <li>whether you are interested in sponsorship or promotional opportunities.</li>
            </ul>
            <p>
              We keep application details even if you do not complete payment, so that we can follow up with you and
              so that you do not have to start again. If you tell us you no longer wish to join, we will delete them.
            </p>

            <h3>2.2 Eligibility information</h3>
            <p>
              BILD membership is limited to people who meet its eligibility criteria. When you apply you confirm that
              you meet those criteria, that the information you have given is true, and that you accept the Terms and
              Conditions. We record those confirmations, and the date you gave them, as evidence that the application
              was properly made. We may ask for further information if an application is unclear.
            </p>

            <h3>2.3 Payment information</h3>
            <p>
              Payments for membership, event tickets, directory listings and Featured placements are processed by
              Stripe. <strong>BILD never sees or stores your card number, expiry date or security code.</strong> Those
              details go directly to Stripe. What we store is the amount, the currency, the payment status, the date,
              a Stripe reference for the transaction and a link to your Stripe receipt, so that we can confirm your
              payment, issue receipts and handle refunds.
            </p>

            <h3>2.4 Event registrations</h3>
            <p>When you book a place at a BILD event we collect:</p>
            <ul>
              <li>your first name, last name, email address and phone number;</li>
              <li>the number of tickets and the names of the guests you are bringing;</li>
              <li>any dietary requirements or allergies you tell us about, which we share with caterers and venues
                only so that they can cater for you safely;</li>
              <li>any accessibility needs or notes you give us.</li>
            </ul>

            <h3>2.5 Business Directory listings</h3>
            <p>If you list a business in the BILD Business Directory we collect:</p>
            <ul>
              <li>the business name, description, category, and the emirate or country it operates in;</li>
              <li>a contact name, email address and phone number for the business;</li>
              <li>the business website, Google Business profile and social media handles;</li>
              <li>your logo, banner image, photographs and any video you upload;</li>
              <li>the member offers you want promoted to the BILD community.</li>
            </ul>
            <p>
              Most of this information is published on your listing, which is what a directory listing is for. The
              contact name, email address and phone number you give us for administration are used to contact you
              about your listing and are not published unless you ask us to publish them.
            </p>

            <h3>2.6 Licence and registration documentation</h3>
            <p>
              Businesses applying to be listed must upload a valid trade licence or company registration document, and
              we record the expiry date so we can ask you to renew it. These documents are held securely, are visible
              only to BILD administrators, and are never published, shared with other members or used for any purpose
              other than checking that the business is registered. Checking a registration document is not an
              endorsement of the business, and is described on the listing as &ldquo;Registration Checked&rdquo; for
              that reason.
            </p>

            <h3>2.7 Reviews, testimonials and feedback</h3>
            <p>
              If you submit a testimonial about BILD we collect your name, your rating and what you have written, and
              we publish it once it has been approved. Where BILD collects feedback about a listed business, we also
              ask for the reviewer&rsquo;s email address and mobile number so that we can check the review is genuine.
              <strong> Those contact details are visible only to BILD administrators and are never published.</strong>
            </p>

            <h3>2.8 Photographs and video</h3>
            <p>
              Photographs and video are taken at BILD events and may be published on this website, in the Photo Vault,
              in Faces of BILD, and on BILD social media accounts, to promote BILD and record its events. If you do
              not wish to be photographed, please tell the organiser before the event, or email us at{' '}
              <a href="mailto:connect@bild.ae">connect@bild.ae</a> and we will remove an image of you.
            </p>

            <h3>2.9 Children and family events</h3>
            <p>
              We collect the ages of members&rsquo; children so that we can plan appropriate activities, group children
              sensibly and meet venue requirements. We collect children&rsquo;s names only where they are attending an
              event as a named guest. We do not knowingly collect any other information about children, we do not
              market to children, and children may not apply for BILD membership themselves. Any information about a
              child is given to us by their parent or guardian and is used only to run the event concerned.
            </p>

            <h3>2.10 WhatsApp and community groups</h3>
            <p>
              BILD runs a community WhatsApp group and a number of specialist sub-groups. To add you to a group we use
              the mobile number you gave us when you applied.{' '}
              <strong>
                Your mobile number and your WhatsApp display name and photo are visible to every other member of any
                group you join.
              </strong>{' '}
              BILD cannot control what other members do with information you post in a group. Please do not post
              anything in a group that you would not want other members to see or keep. Members must not collect,
              export or reuse other members&rsquo; contact details, and doing so is a breach of the Community Rules.
              WhatsApp is operated by Meta and its own privacy policy applies to your use of the app.
            </p>

            <h3>2.11 Marketing communications</h3>
            <p>
              We send members emails about events, membership, the directory and BILD news. You can unsubscribe at any
              time using the link in any email, or by emailing <a href="mailto:connect@bild.ae">connect@bild.ae</a>.
              We will still send you service messages you need to receive, such as a payment confirmation, a ticket
              confirmation or a renewal reminder, because these relate to something you have bought.
            </p>

            <h3>2.12 Website and technical information</h3>
            <p>
              When you use this website we collect standard technical information, including your IP address, browser
              and device type, the pages you visit and how you arrived at the site. We use Google Analytics to
              understand how the site is used, and Sentry to detect and diagnose errors. This information is used in
              aggregate to improve the site. We also count how many times a Featured business profile has been viewed,
              and we report that count to the business as a number only, never as a list of who viewed it.
            </p>

            <h2>3. Why we use your information</h2>
            <ul>
              <li>To assess your application and confirm that you meet the eligibility criteria.</li>
              <li>To take payment and issue receipts, and to handle refunds.</li>
              <li>To add you to the BILD community groups and give you access to member services.</li>
              <li>To organise and run events, including catering, capacity and safety.</li>
              <li>To publish and administer Business Directory listings.</li>
              <li>To communicate with you about your membership, your bookings and your listing.</li>
              <li>To promote BILD and its events, including through photographs and social media.</li>
              <li>To keep the community safe, enforce the Community Rules and the Terms and Conditions, and prevent
                misuse.</li>
              <li>To meet our legal, licensing, accounting and tax obligations.</li>
            </ul>

            <h2>4. Our legal basis</h2>
            <p>
              We process personal information on the basis of your consent, given when you submit an application, book
              an event or submit a listing; because it is necessary to provide the membership or service you have
              asked for; because we have a legitimate interest in running and protecting the community; and because we
              are required to by law. Where we rely on your consent, you may withdraw it at any time by contacting us,
              although that may mean we can no longer provide part of the service.
            </p>

            <h2>5. Who we share your information with</h2>
            <p>
              BILD does not sell your personal information, and does not share it for anyone else&rsquo;s marketing.
              We share it only with the service providers we need to run BILD:
            </p>
            <ul>
              <li><strong>Stripe</strong> - payment processing.</li>
              <li><strong>Supabase</strong> - the database and file storage behind this website.</li>
              <li><strong>Vercel</strong> - website hosting.</li>
              <li><strong>Resend</strong> - sending transactional and community emails.</li>
              <li><strong>Google</strong> - Analytics, and Google Business reviews shown on the site.</li>
              <li><strong>Sentry</strong> - error monitoring.</li>
              <li><strong>WhatsApp (Meta)</strong> - community groups.</li>
              <li><strong>Event venues, caterers and suppliers</strong> - only the details needed to run an event,
                such as a guest list or dietary requirements.</li>
            </ul>
            <p>
              We may also disclose information where we are required to do so by law, by a regulator or by a court, or
              where it is necessary to protect the safety of a member or the public.
            </p>

            <h2>6. Where your information is held</h2>
            <p>
              Our service providers operate internationally, so your information may be stored or processed outside
              the UAE, including in the European Union and the United States. We only use established providers that
              apply recognised security and data protection standards.
            </p>

            <h2>7. How long we keep it</h2>
            <ul>
              <li><strong>Member records</strong> - for as long as you are a member, and for up to three years after
                your membership ends, so that we can deal with any question about your membership or payment.</li>
              <li><strong>Incomplete applications</strong> - for up to twelve months, so we can follow up with you.</li>
              <li><strong>Event registrations</strong> - for up to three years, for accounting and event records.</li>
              <li><strong>Payment records</strong> - for as long as UAE accounting and tax law requires.</li>
              <li><strong>Business listings and licence documents</strong> - for as long as the listing is live, and
                for up to two years afterwards.</li>
              <li><strong>Photographs and video</strong> - indefinitely, as part of BILD&rsquo;s record of its events,
                unless you ask us to remove an image of you.</li>
            </ul>

            <h2>8. Your rights and choices</h2>
            <p>You may ask us at any time to:</p>
            <ul>
              <li>tell you what personal information we hold about you;</li>
              <li>give you a copy of it;</li>
              <li>correct anything that is wrong or out of date;</li>
              <li>delete your information, where we are not required to keep it;</li>
              <li>stop sending you marketing emails;</li>
              <li>remove a photograph of you from this website or BILD social media;</li>
              <li>remove you from a WhatsApp group;</li>
              <li>withdraw a consent you previously gave.</li>
            </ul>
            <p>
              Email <a href="mailto:connect@bild.ae">connect@bild.ae</a> and we will respond within 30 days. We may ask
              you to confirm your identity first. Deleting your information will normally end your membership, and the
              membership fee is not refunded on deletion.
            </p>

            <h2>9. Security</h2>
            <p>
              Access to member records, licence documents and reviewer contact details is restricted to BILD
              administrators. Data is transmitted over encrypted connections and held in access-controlled systems.
              Card details never reach BILD&rsquo;s systems at all. No system is completely secure, so we cannot
              guarantee absolute security, but if a breach affects your information we will tell you and take the
              steps the law requires.
            </p>

            <h2>10. Cookies and analytics</h2>
            <p>
              This website uses cookies and similar technologies that are necessary for the site to work, and Google
              Analytics cookies that help us understand how the site is used. You can block or delete cookies through
              your browser settings, although parts of the site may not work correctly if you do.
            </p>

            <h2>11. Other websites</h2>
            <p>
              The Business Directory and other pages link to websites and social media profiles that BILD does not
              control. This policy does not apply to them, and BILD is not responsible for how they handle your
              information.
            </p>

            <h2>12. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. The date at the top shows when it was last changed, and
              continued use of BILD&rsquo;s services after a change means you accept the updated policy.
            </p>

            <h2>13. Contact us</h2>
            <p>
              For any question, request or complaint about your personal information, email{' '}
              <a href="mailto:connect@bild.ae">connect@bild.ae</a>. This policy should be read together with
              BILD&rsquo;s <a href="/terms">Terms and Conditions</a>, its{' '}
              <a href="/refund-policy">Refund Policy</a> and its <a href="/community-rules">Community Rules</a>.
            </p>
          </article>
        </div>
      </div>
    </>
  )
}
