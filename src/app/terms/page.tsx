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
  title: 'Terms & Conditions',
  description: 'Terms and conditions for BILD membership, the membership fee, eligibility criteria, and use of the BILD network in Dubai and the UAE.',
}

// Shown at the top of the page. Section 14 says continued membership after an
// update constitutes acceptance, which is impossible to rely on without a way
// of telling which version somebody continued under. Update this whenever the
// Terms change.
const LAST_UPDATED = '11 September 2026'

export default async function TermsPage() {
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="Terms & Conditions" subtitle="Please read these terms carefully before applying for membership">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article className="prose prose-lg prose-charcoal max-w-none">
            <p className="lead">
              Welcome to BILD (British Indians Living in Dubai). Please read these Terms and Conditions carefully
              before applying for membership.
            </p>
            <p>
              <strong>Last updated:</strong> {LAST_UPDATED}
            </p>
            <p>
              BILD&rsquo;s <a href="/community-rules">Community Rules</a>, <a href="/privacy">Privacy Policy</a> and{' '}
              <a href="/refund-policy">Refund Policy</a> each form part of these Terms. Where these Terms and the
              Refund Policy differ on any question of refunds, the Refund Policy prevails.
            </p>

            <h2>1. About BILD</h2>
            <p>
              BILD (British Indians Living in Dubai) is a British Indian membership network founded in Dubai in 2019,
              operating under a Dubai commercial trade licence. Its purpose is to bring people together, create a sense
              of belonging, and support British Indians as they settle, connect and build friendships in the UAE.
            </p>
<p>
              BILD is a membership network dedicated to celebrating and supporting the shared cultural identity,
              social connections, and professional growth of British Indians living in Dubai. Our activities focus on
              cultural celebrations, social events, family-friendly gatherings, and promoting British Indian
              businesses and professionals.
            </p>
            <p>
              BILD embraces inclusivity regardless of religion or faith, whilst remaining centred on the unique
              experiences of British Indians living abroad.
            </p>
            <p>
              Income from membership fees, events, listings and sponsorships is used to fund the operation and delivery
              of BILD&rsquo;s services, covering operating costs, licensing, administration, events and member
              engagement.
            </p>

            <h2>2. Eligibility</h2>
<p>
              Membership of BILD is open exclusively to individuals of Indian origin who were born, raised, or
              previously settled in the United Kingdom, who identify with both British and Indian culture, and who
              are currently residing in the UAE.
            </p>
            <p>
              Membership is also open to the spouse or partner of an individual who meets those criteria. BILD
              welcomes all faiths and backgrounds within the British Indian community.
            </p>
            <p>
              BILD is specifically centred around this shared cultural identity and lived experience of being British
              Indian and does not discriminate on the basis of religion or faith. We welcome British Indians from all
              faiths.
            </p>
            <p>
              We appreciate the diversity within the broader South Asian community and recognise that there are many
              wonderful groups in UAE that reflect other backgrounds. Hence, BILD exists solely to provide a secure
              space for the unique British Indian voice and experience to thrive abroad.
            </p>
            <p>
              Membership is open to individuals aged 18 or over. Children are very welcome at BILD events as the
              guests of a member, and many BILD events are designed for families, but a child cannot hold membership
              in their own right. A parent or guardian remains responsible for any child they bring to an event at
              all times.
            </p>

            <h2>3. Membership Application</h2>
<p>
              All membership applications are subject to review by the BILD team to confirm they meet the
              eligibility criteria set out in Section 2. BILD reserves the right to decline or revoke membership at
              any time if it is determined that an individual does not meet these eligibility criteria or has acted
              in breach of these Terms.
            </p>
<p>
              Membership is granted based on trust and honesty. Any member found to have misrepresented their identity
              or eligibility may be removed from the community without prior notice.
            </p>

            <h2>4. Membership Fee</h2>
            <p>
              BILD charges a one-time membership fee of 50 AED to access its network and services. This fee covers
              essential operating costs, licensing costs, administration, events, member engagement, and the creation
              of spaces and activities that bring members together.
            </p>
            <p>
              Refunds of the membership fee are governed by BILD&rsquo;s current{' '}
              <a href="/refund-policy">Refund Policy</a>, which prevails over these Terms on any question of refunds.
              In summary, the membership fee is non-refundable once paid, and removal or suspension of membership
              under section 13 does not create a right to a refund. BILD may amend its fee amounts from time to time
              at its discretion; a change does not affect a fee already paid.
            </p>

            <h2>5. Membership Access</h2>
            <p>
              Payment of the membership fee gives members access to the BILD network, which currently includes multiple
              groups, events, activities, and online platforms. Access may include, where applicable, social groups,
              lifestyle and interest-based groups, business networking groups, events, cultural celebrations, coffee
              mornings, meet ups, buy and sell groups, book clubs, walking groups, padel, golf, and other member
              activities.
            </p>
            <p>
              BILD aims to provide a kind, supportive and inclusive environment that encourages real connection, shared
              experiences and lasting friendships. However, membership does not guarantee participation in any specific
              group, event, activity, benefit or opportunity. Access to certain groups, events or activities may be
              subject to availability, suitability, capacity, additional costs, separate terms, or approval by BILD
              administrators.
            </p>

            <h3>5.1 Dealings between members</h3>
            <p>
              Members buy from, sell to, lend to, hire and recommend one another, including through buy and sell
              groups and through recommendations shared in any BILD group.{' '}
              <strong>
                Any such dealing is strictly between the members concerned. BILD is not a party to it, does not
                introduce, broker, vet or guarantee it, holds no money in respect of it, provides no payment, escrow
                or delivery service, and takes no commission from it.
              </strong>
            </p>
            <p>
              BILD does not check the accuracy of anything a member says about goods, services, prices, qualifications
              or availability, and gives no warranty as to the quality, safety, legality or fitness for purpose of
              anything obtained from another member. Members deal with one another entirely at their own risk and
              should carry out their own checks and agree their own terms before doing so.
            </p>
            <p>
              A dispute about anything bought from or sold to another member must be raised directly with that member.
              BILD is not a dispute resolution service, does not adjudicate such disputes, and cannot compel a refund,
              a remedy or performance. Concerns may still be reported to{' '}
              <a href="mailto:connect@bild.ae">connect@bild.ae</a>, and BILD may act under section 13, but it is under
              no obligation to investigate, to take any action, or to report an outcome, and doing so creates no
              liability on BILD&rsquo;s part.
            </p>
            <p>
              Information and recommendations shared in BILD groups, including in the Community Knowledge Base, are
              the opinions of the members who posted them and not advice from BILD. They must not be relied on as
              professional, legal, medical, financial or immigration advice.
            </p>

            <h2>6. Member Responsibilities</h2>
<p>
              Members are expected to uphold the values of respect, honesty, and kindness in all interactions within
              the community. Discriminatory, offensive, or harmful behaviour will not be tolerated. Members must also
              comply with all applicable UAE laws and regulations while participating in all BILD activities and group
              chats.
            </p>
<p>
              Members agree to abide by all relevant UAE laws and regulations while participating in BILD events and
              activities.
            </p>
            <p>
              By submitting a membership application or participating in BILD activities, you agree to these Terms and
              Conditions and BILD community rules.
            </p>
            <p>
              Contact us at{' '}
              <a href="mailto:connect@bild.ae" className="text-gold-600">connect@bild.ae</a>{' '}
              for any questions or further clarification.
            </p>

            <h2>7. Community and Social Media Groups</h2>
            <p>
              Much of BILD&rsquo;s activity takes place in WhatsApp and other online groups. Membership of those groups
              is a benefit of membership, not a right, and is subject to our{' '}
              <a href="/community-rules">Community Rules</a>, which form part of these Terms. Group invitations are
              personal to the member and must not be forwarded or shared.
            </p>
            <p>
              Members must not use group membership to send unsolicited marketing, to collect or export other
              members&rsquo; contact details, or to advertise without the prior approval of BILD administrators.
              Administrators may remove content, or remove a member from any group, in line with the Community Rules
              and section 13 of these Terms.
            </p>

            <h2>8. Events</h2>
<p>
              Event cancellations, transfers and refunds are governed by BILD&rsquo;s current{' '}
              <a href="/refund-policy">Refund Policy</a>. Where these Terms and the Refund Policy differ on any
              question of refunds, the Refund Policy prevails.
            </p>
            <ul>
              <li>Event tickets are non-refundable unless the event is cancelled by BILD.</li>
              <li>In the event of cancellation, BILD will offer a refund or credit towards a future event, as set out
                in the <a href="/refund-policy">Refund Policy</a>.</li>
              <li>BILD reserves the right to refuse entry to any event.</li>
              <li>BILD is not responsible for personal injury, loss, or damage arising from attendance at events.</li>
            </ul>

            <h3>8.1 Guests</h3>
            <p>
              A member may book tickets for guests. The member who books is responsible for their guests: for the
              accuracy of the details given for each of them, including any dietary requirement or allergy; for their
              guests&rsquo; conduct at the event; and for ensuring their guests are aware of, and follow, these Terms
              and the <a href="/community-rules">Community Rules</a> while attending. Guests are bound by the same
              standards of behaviour as members while at a BILD event.
            </p>
            <p>
              BILD may refuse entry to, or remove, any guest on the same grounds as it may a member, and conduct by a
              guest may be treated as conduct by the member who brought them for the purposes of section 13.
            </p>
            <p>
              Dietary and allergy information is passed to caterers and venues as given. BILD is not a caterer, does
              not prepare food, and cannot guarantee that any dish is free from a particular ingredient or from
              cross-contamination. Anyone with a severe allergy should speak to the venue directly on arrival.
            </p>
            <p>
              Tickets must not be resold for more than the price paid. Transfers are dealt with in the{' '}
              <a href="/refund-policy">Refund Policy</a>.
            </p>

            <h2>9. Business Directory</h2>
<p>
              This section applies to every business listed, or applying to be listed, in the BILD Business Directory
              (a <strong>&ldquo;Listed Business&rdquo;</strong>), and to every person who views or uses the directory.
              By submitting a listing, a Listed Business accepts this section. A summary of the key points also appears
              on the directory page itself; this section prevails if the two ever differ.
            </p>

            <h3>9.1 What the directory is</h3>
            <p>
              The BILD Business Directory and the Community Knowledge Base are information services. They are a place
              for members and the public to find British Indian businesses and professionals. BILD is not a broker,
              agent, introducer, marketplace or intermediary, is not a party to any dealing between a user and a Listed
              Business, and takes no commission on any such dealing.
            </p>

            <h3>9.2 Eligibility</h3>
            <p>
              Listings are open to businesses holding a valid United Arab Emirates trade licence, and to businesses
              holding a valid United Kingdom business registration. A UK-registered business may be listed on the basis
              that its services are delivered in the United Kingdom, and its listing is marked accordingly. Listing is
              open to both BILD members and non-members, at the applicable fee. BILD may decline any application at its
              discretion.
            </p>

            <h3>9.3 Registration documentation</h3>
            <p>
              A Listed Business must provide, and keep current, a copy of its UAE trade licence or UK business
              registration document, together with the document&rsquo;s expiry date where one applies. Documents are
              held for verification purposes and are not published. Providing a false, altered, expired or third
              party&rsquo;s document is a serious breach of these Terms and will result in immediate removal.
            </p>

            <h3>9.4 The &ldquo;Registration Checked&rdquo; marking</h3>
            <p>
              Where a listing displays &ldquo;Registration Checked&rdquo;, this means only that BILD has received and
              checked documentation showing the business holds the stated UAE trade licence or UK business
              registration. That check is limited to sighting the document at the time it was supplied. It is{' '}
              <strong>not</strong> an endorsement, recommendation, accreditation or guarantee of the business, its
              owners, its services, its competence, its solvency or its regulatory standing, and BILD does not verify
              that a licence or registration remains valid after it has been sighted.
            </p>

            <h3>9.5 Regulated businesses and professions</h3>
            <p>
              Some activities require additional licences, permits, registrations or professional authorisations beyond
              a trade licence or company registration, including but not limited to legal, medical, dental, financial,
              insurance, real estate, education, childcare, food and beverage, cosmetic and construction services. A
              Listed Business is solely responsible for holding and maintaining every such authorisation required for
              its activities in the jurisdictions where it operates. BILD does not check for, and makes no
              representation about, any such authorisation. Users requiring a regulated service should verify a
              provider&rsquo;s standing with the relevant regulator before engaging them.
            </p>

            <h3>9.6 Accuracy of information</h3>
            <p>
              All listing content, including descriptions, categories, contact details, credentials, trading history,
              images, offers and links, is supplied by the Listed Business. The Listed Business warrants that its
              content is accurate, not misleading, and that it holds all rights necessary to publish it, including
              rights in any image, logo or photograph it uploads. BILD does not independently check listing content and
              gives no representation or warranty as to its accuracy, completeness or currency.
            </p>

            <h3>9.7 Keeping a listing up to date</h3>
            <p>
              A Listed Business is responsible for keeping its listing accurate, including where it ceases trading,
              changes ownership, changes its services, or its licence or registration lapses, is suspended or is
              revoked. A Listed Business must notify BILD promptly of any such change. BILD issues reminders before a
              recorded document expiry date as a courtesy only; the obligation to keep the listing correct rests with
              the Listed Business, whether or not a reminder is received.
            </p>

            <h3>9.8 Approval, rejection, suspension and removal</h3>
            <p>
              BILD may, at its sole discretion and without liability, decline an application, or suspend, amend or
              remove a listing at any time, including where: documentation is missing, expired or cannot be verified;
              content is inaccurate, misleading, unlawful or offensive; a complaint has been received; the business has
              ceased trading; fees are unpaid; or BILD considers the listing inconsistent with the values of the BILD
              community. Where a listing is removed for non-payment or an expired document, it may be restored once the
              position is corrected. Fees already paid are not refunded on removal for breach.
            </p>

            <h3>9.9 Listing fees</h3>
            <p>
              Listing is charged annually, at a different rate for BILD members and for non-member businesses. The
              current fees are published on the <a href="/directory">Business Directory</a> page and are confirmed at
              the point of application, before any payment is taken. Fees are quoted in UAE Dirhams, are payable in
              advance, and are collected by card through our payment provider. A card processing charge
              may be added at checkout and is shown before payment is taken. Submitting a listing for review is free;
              payment is requested only after a listing is approved. Except where required by law, fees are
              non-refundable, including where a listing is later removed under clause 9.8, subject to BILD&rsquo;s{' '}
              <a href="/refund-policy">Refund Policy</a>. BILD may change its fees on
              reasonable notice; a change does not affect a period already paid for.
            </p>

            <h3>9.10 Introductory and free periods</h3>
            <p>
              BILD may offer introductory, discounted, complimentary or promotional listing periods, including a free
              period for BILD member businesses. Any current introductory period and its end date are stated
              on the <a href="/directory">Business Directory</a> page. Any such period is a concession
              offered at BILD&rsquo;s discretion, does not create an entitlement to future free or discounted periods,
              and may be varied or withdrawn for future periods on reasonable notice. When a free or introductory
              period ends, the standard fee applies for continued listing.
            </p>

            <h3>9.11 Renewal and expiry</h3>
            <p>
              Listings do not renew automatically and are not charged automatically; continued listing requires payment
              for the following period. BILD sends renewal reminders before expiry as a courtesy. A listing which is
              not renewed, or whose registration document has expired, is removed from public view until the position
              is corrected. BILD is not liable for any loss arising from a listing being removed in these
              circumstances, including where a reminder was not received.
            </p>

            <h3>9.12 Featured listings</h3>
            <p>
              A Listed Business may purchase Featured placement, charged quarterly and in addition to the listing fee,
              at a different rate for BILD members and for non-members. The current Featured fees are published on the
              <a href="/directory/get-featured"> Featured</a> page and are confirmed before any payment is taken. Featured placement provides enhanced prominence in the directory and additional
              profile content such as an extended description, image gallery, video and multiple member offers.
              Featured placement is a promotional service only. It is not a ranking of quality, an endorsement, or any
              indication that a Featured business is more reputable, more competent or better value than any other
              listing. BILD does not guarantee any particular level of views, enquiries, leads or business resulting
              from a listing or from Featured placement.
            </p>

            <h3>9.13 Member offers</h3>
            <p>
              A Listed Business may publish an offer, discount or promotion for BILD members. Any such offer is made by
              the Listed Business and not by BILD. The Listed Business is responsible for honouring it on the terms
              stated, for the accuracy of those terms, and for any conditions, exclusions or expiry applying to it.
              BILD is not a party to the offer, does not fund it, and accepts no liability if it is withdrawn, altered,
              refused or not honoured.
            </p>

            <h3>9.14 Links to external websites</h3>
            <p>
              Listings contain links to websites, social media profiles and booking pages operated by third parties.
              Those sites are outside BILD&rsquo;s control. BILD does not review, endorse or accept responsibility for
              their content, their availability, their security, their privacy practices, or anything obtained through
              them. Following an external link is at the user&rsquo;s own risk and is subject to that site&rsquo;s own
              terms.
            </p>

            <h3>9.15 Contact buttons</h3>
            <p>
              Contact features such as WhatsApp, telephone, email and map links are conveniences that pass a
              user&rsquo;s device to a third party application or service using details supplied by the Listed
              Business. BILD does not send, receive, monitor, store or moderate communications made through them, is
              not responsible for their availability or accuracy, and is not a party to any conversation or agreement
              that follows.
            </p>

            <h3>9.16 No endorsement</h3>
            <p>
              Inclusion in the directory, appearance in any category or search result, the order in which listings
              appear, a &ldquo;Registration Checked&rdquo; marking, Featured placement, and the display of any Google
              rating or member review do not constitute an endorsement, recommendation, approval or accreditation by
              BILD of any Listed Business or of anything it supplies.
            </p>

            <h3>9.17 No guarantee</h3>
            <p>
              BILD gives no guarantee or warranty of any kind regarding any Listed Business, including as to the
              quality, safety, legality, timeliness, suitability or fitness for purpose of any product or service, the
              qualifications, competence, honesty, identity or financial standing of any business or individual, the
              accuracy of any price, credential or claim, or the continued validity of any licence or registration.
            </p>

            <h3>9.18 Dealings are directly between the parties</h3>
            <p>
              Any enquiry, quotation, booking, contract, transaction, payment or other dealing between a user and a
              Listed Business is strictly between those parties. BILD is not a party to it, provides no payment,
              escrow, delivery or guarantee service in respect of it, and receives no commission from it. Users engage
              Listed Businesses entirely at their own risk and should carry out their own checks, take their own
              advice, and agree their own terms before doing so.
            </p>

            <h3>9.19 Complaints and disputes</h3>
            <p>
              A dispute concerning a product or service must be raised directly with the Listed Business. BILD is not a
              dispute resolution service, does not adjudicate disputes, and cannot compel a refund, a remedy or
              performance. Concerns about a listing may nonetheless be reported to{' '}
              <a href="mailto:connect@bild.ae">connect@bild.ae</a>. BILD may, at its discretion, contact the business,
              request information, or suspend or remove the listing under clause 9.8, but is under no obligation to
              investigate, to take any action, or to report an outcome, and doing so creates no liability on
              BILD&rsquo;s part.
            </p>

            <h3>9.20 Misleading claims and prohibited content</h3>
            <p>
              A Listed Business must not publish anything false, deceptive or misleading, including invented
              credentials, qualifications or affiliations; claims to be regulated, certified, accredited or approved
              when it is not; false claims of BILD membership, endorsement or partnership; fabricated reviews,
              ratings or testimonials; prices or offers it does not intend to honour; or another party&rsquo;s
              trade marks, images or content used without permission. Listings must not contain unlawful, obscene,
              discriminatory, defamatory or harassing material, and must not promote activity that is illegal in the
              United Arab Emirates.
            </p>

            <h3>9.21 Advertising and marketing compliance</h3>
            <p>
              A Listed Business is responsible for ensuring its listing, offers and any related marketing comply with
              all applicable advertising, consumer protection, e-commerce, data protection and anti-spam laws in the
              jurisdictions where it operates, including UAE consumer protection requirements. A Listed Business must
              not use contact details obtained through the directory or the BILD community to send unsolicited
              marketing.
            </p>

            <h3>9.22 Licences and approvals remain the responsibility of the business</h3>
            <p>
              Nothing in the directory, and nothing done by BILD, relieves a Listed Business of responsibility for
              obtaining and maintaining every licence, permit, registration, insurance and regulatory approval required
              for its activities. Responsibility for compliance rests solely and at all times with the Listed Business.
            </p>

            <h3>9.23 Liability</h3>
            <p>
              To the fullest extent permitted by applicable law, BILD, its owners, operators, administrators and
              volunteers shall not be liable for any loss, damage, cost, expense, delay, injury or claim of any kind,
              whether direct, indirect, incidental or consequential, arising out of or in connection with any listing,
              any content within it, any dealing with or reliance upon a Listed Business, or the unavailability,
              suspension or removal of any listing. This clause is in addition to, and does not limit, section 12
              below.
            </p>

            <h3>9.24 Indemnity</h3>
            <p>
              A Listed Business indemnifies BILD against any claim, demand, loss, damage, cost or expense (including
              reasonable legal fees) arising from its listing, its content, its offers, its acts or omissions, its
              dealings with users, or its breach of these Terms.
            </p>

            <h2>10. Photography, Media and Content</h2>

            <h3>10.1 Photography at events</h3>
            <p>
              By attending BILD events, you acknowledge that photographs and videos may be taken and used for BILD
              community purposes, including on this website and social media. If you do not wish to be photographed,
              please inform the organiser prior to the event via email on{' '}
              <a href="mailto:events@bild.ae">events@bild.ae</a>. You may also ask us at any time to remove a
              photograph of you that has already been published, and we will do so.
            </p>

            <h3>10.2 Content you give us</h3>
            <p>
              Members and businesses submit content to BILD: testimonials and reviews, business descriptions, logos,
              banners, photographs and video, member offers, and photographs uploaded to the Photo Vault. By
              submitting any of it you confirm that it is yours to give, or that you have permission to give it, and
              that publishing it will not infringe anyone else&rsquo;s rights.
            </p>
            <p>
              You keep ownership of everything you submit. You grant BILD a non-exclusive, royalty-free licence to
              publish, display, reproduce and adapt it for the purpose of running and promoting BILD, including on
              this website, in emails and on BILD social media. You may withdraw that licence for anything you have
              submitted by emailing <a href="mailto:connect@bild.ae">connect@bild.ae</a>, and BILD will remove it
              within a reasonable period, although BILD is not required to recall material already printed or
              distributed.
            </p>
            <p>
              A testimonial is published under the name given when it was submitted. BILD may decline to publish, or
              may later remove, any submitted content at its discretion, and may correct obvious errors of spelling
              or formatting without changing its meaning.
            </p>

            <h3>10.3 BILD&rsquo;s own content</h3>
            <p>
              The BILD name, logo, branding, website design, written content, and the structure and selection of the
              Business Directory belong to BILD or are used by BILD under licence. They may not be copied, reproduced,
              republished or used to imply endorsement by, or affiliation with, BILD without prior written permission.
              Members and Listed Businesses may of course say that they are a BILD member or listed in the BILD
              Business Directory, provided that is accurate and is not presented as a BILD endorsement of them.
            </p>

            <h2>11. Privacy</h2>
<p>
              Personal information collected during membership applications, event bookings and directory listings
              will be used only for BILD community purposes and will be handled securely in line with applicable data
              protection laws.
            </p>
            <p>
              BILD&rsquo;s <a href="/privacy">Privacy Policy</a> sets out in full what personal information BILD
              collects, why it is collected, who it is shared with, how long it is kept, and the rights you have over
              it. It forms part of these Terms.
            </p>

            <h2>12. Liability</h2>
            <p>
              BILD is a business operating under a Dubai commercial trade licence. To the fullest extent permitted by
              applicable law, BILD, its owners, operators, administrators and volunteers shall not be liable for any
              loss, damage, cost, expense, delay, injury or claim of any kind, whether direct, indirect, incidental or
              consequential, arising out of or in connection with:
            </p>
            <ul>
              <li>membership of BILD, or its suspension, removal or termination;</li>
              <li>attendance at, or participation in, any BILD event or activity, including sporting and physical
                activities such as padel, golf and walking groups, which members and their guests take part in at
                their own risk and having satisfied themselves that they are fit to do so;</li>
              <li>the acts, omissions, condition or closure of any third party venue, caterer, supplier or performer;</li>
              <li>anything said, shared, recommended or relied upon in any BILD group or platform, which is the
                opinion of the member who posted it and not advice from BILD;</li>
              <li>any dealing between members, as set out in section 5.1, or with a Listed Business, as set out in
                section 9;</li>
              <li>loss of or damage to personal property at an event;</li>
              <li>the unavailability, interruption or malfunction of this website or of any third party service BILD
                relies on, including payment processing, email and messaging platforms; or</li>
              <li>any event that is cancelled, postponed, cut short or changed, beyond what the{' '}
                <a href="/refund-policy">Refund Policy</a> provides.</li>
            </ul>
            <p>
              Nothing in these Terms excludes or limits any liability which cannot lawfully be excluded or limited,
              including liability for death or personal injury caused by negligence. Where BILD is found liable
              despite the above, its total liability is limited to the amount you have paid to BILD in the twelve
              months before the claim arose.
            </p>

            <h2>13. Suspension and Termination</h2>
            <p>
              BILD may suspend or terminate a membership, remove a member from any BILD group, event or platform, or
              decline a future application, at its sole discretion and with immediate effect, where a member:
            </p>
            <ul>
              <li>breaches these Terms;</li>
              <li>breaches the <a href="/community-rules">Community Rules</a>;</li>
              <li>provides false, misleading or incomplete information, including as to identity or eligibility;</li>
              <li>behaves abusively, aggressively or offensively towards any member, guest, partner or administrator;</li>
              <li>harasses, bullies, intimidates or discriminates against another person;</li>
              <li>posts prohibited content, including unlawful, obscene, defamatory or discriminatory material;</li>
              <li>advertises, promotes or solicits without the prior approval of BILD administrators;</li>
              <li>misuses member information, including collecting, exporting, sharing or using another member&rsquo;s
                contact details for a purpose other than genuine community interaction;</li>
              <li>breaches UAE law, or uses BILD in connection with unlawful activity; or</li>
              <li>acts in a way that compromises the safety, privacy, wellbeing or reputation of the community.</li>
            </ul>
            <p>
              BILD will normally seek to resolve matters informally first, but is not obliged to give warning, notice
              or reasons before acting where it considers the circumstances serious. A member may also leave BILD at
              any time by notifying us at <a href="mailto:connect@bild.ae">connect@bild.ae</a>.
            </p>
            <p>
              <strong>Removal, suspension or termination of membership does not automatically create a right to a
              refund of the membership fee, of any event ticket, or of any listing or Featured placement fee.</strong>{' '}
              Where a listing is affected, clause 9.8 also applies. BILD accepts no liability for any loss arising from
              a suspension, removal or termination made in accordance with this section.
            </p>

            <h2>14. Changes to BILD</h2>
            <p>
              BILD reserves the right to amend its membership structure, groups, events, activities, access rules, fee
              amounts and member benefits from time to time. Any such changes will be made at BILD&rsquo;s discretion.
            </p>
<p>
              BILD may update these Terms from time to time. Continued membership following an update constitutes
              acceptance of the revised Terms. We will notify members of material changes.
            </p>

            <h2>15. Governing Law</h2>
<p>
              These Terms are governed by the laws of the United Arab Emirates. Any disputes shall be subject to the
              exclusive jurisdiction of the courts of Dubai.
            </p>
            <p>
              By submitting a membership application, paying the membership fee, or participating in BILD activities,
              you acknowledge that you have read, understood and agreed to these Terms.
            </p>
          </article>
        </div>
      </div>
    </>
  )
}
