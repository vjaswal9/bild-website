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
  title: 'Community Rules',
  description: 'The rules and etiquette for BILD\'s WhatsApp groups and social media platforms for British Indians in Dubai and the UAE.',
}

export default async function CommunityRulesPage() {
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="Community Rules" subtitle="BILD Community & Social Media Group Rules">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article className="prose prose-lg prose-charcoal max-w-none">
            <p className="lead">Dear BILD Lads &amp; Ladies,</p>

            <p>
              Welcome to the BILD Family, a vibrant space for BILD members to share our experiences, knowledge,
              and advice as we navigate life together in the sandpit!
            </p>
            <p>
              BILD is a kind, tolerant, and inclusive community, built from the heart solely to bring people
              together through cultural events, activities, and meaningful connections. It&rsquo;s a fun, supportive
              network and a safe space for like-minded British Indians to connect.
            </p>

            <h2>Join Us On</h2>
            <ul>
              <li>
                <strong>WhatsApp (WA):</strong> BILD Community WA &amp; various sub-groups (please keep conversations
                relevant to the group topic. For specific topics, refer to dedicated sub-groups.)
              </li>
              <li><strong>Instagram:</strong> @BILD_ae</li>
              <li><strong>Facebook:</strong> Brit Indians Living in Dubai &amp; UAE (BILD)</li>
              <li><strong>Website:</strong> BILD.ae</li>
              <li><strong>LinkedIn:</strong> BILD Community for British Indian Professionals in Dubai &amp; UAE</li>
            </ul>
            <p>Follow and support us by sharing our community and joining us at BILD events.</p>
            <p>Let&rsquo;s grow stronger together, BILD Lads, Ladies, and Families!</p>

            <p className="text-sm text-charcoal-500">
              Please note: These social media platforms are for informational and networking purposes only. The
              opinions expressed by members are their own and do not reflect the views of the Group Admin (including
              the Founder). Group Admins are not responsible for the accuracy of shared content or any consequences
              arising from it. Please avoid sharing sensitive, defamatory, or illegal content from elsewhere and
              refrain from sharing or circulating any material from our groups which are private and confidential to
              our community. By remaining in the group, you are deemed to always agree and abide by these terms as
              they change or are updated from time to time.
            </p>

            <h2>Purpose</h2>
            <p>
              BILD social media platforms are dedicated exclusively to those of British Indian heritage, or the
              spouse or partner of someone who is, now living in the UAE. Please read these Terms and Conditions carefully
              before applying for membership.
            </p>
            <p>
              We are a space for those of Indian origin who were born, raised, or previously settled in the UK, and who are of both
              British and Indian culture. BILD aims to foster networking in a respectful and secure environment.
              BILD is specifically centred around the shared cultural identity and lived experience of being British
              Indian and does not discriminate on the basis of religion or faith. We appreciate the diversity within
              the broader South Asian community and recognise that there are many wonderful groups in UAE that
              reflect other backgrounds. BILD exists solely to provide a space for the unique British Indian voice
              and experience to thrive abroad.
            </p>
            <p>
              You are encouraged to welcome other British Indians into this social network by inviting friends, as
              each new member enhances the overall value and sharing of experiences within our community.
            </p>
            <p>
              To ensure a seamless integration and avoid any misunderstandings, please ensure you familiarise
              yourself with BILD&rsquo;s principles and rules. Upon joining, an essential prerequisite is for all members
              to introduce themselves. Please share a brief introduction to the group to facilitate easier
              connections and interactions. Any anonymous joiners who do not provide their identity will be removed.
            </p>

            <h2>Community Rules</h2>

            <h3>1. Be Kind, Courteous &amp; Inclusive</h3>
            <ul>
              <li>Words build trust and friendships, so use them kindly and be respectful.</li>
              <li>
                Light-hearted humour is welcome but must not target or offend specific individuals or groups or
                cause distress to others.
              </li>
              <li>
                Opinions may vary, so be considerate in your communications and avoid false accusations. Please think
                carefully before posting any comment or response.
              </li>
            </ul>

            <h3>2. Act Responsibly</h3>
            <p>You MUST always comply with all UAE Laws and social media regulations.</p>
            <p>
              We strictly enforce a zero-tolerance policy towards any form of communication which targets any race,
              religion, nationality, or individual, or contains any aggressive behaviour, bullying, hate speech,
              profanity, other discriminatory remarks, or offensive adult content, including humour which can be
              construed as offensive.
            </p>
            <p>Posts of a political nature are also not allowed.</p>
            <p>Please also refrain from using foul language.</p>
            <p>
              Please do not post articles from unverified sources or share content that causes unnecessary panic,
              especially anything which is highly likely to be &lsquo;fake news.&rsquo;
            </p>
            <p>All of the above includes any content in any format, such as messages, images, videos, or links.</p>
            <p>
              Our administrators reserve the right to delete any content deemed inappropriate or contrary to the
              group&rsquo;s principles and ethos, potentially causing undue friction among members.
            </p>
            <p>
              Please be aware that violations of these rules and principles may result in the removal of members from
              the group without prior notice. We are committed to upholding the laws of the UAE and fostering a
              positive and respectful community.
            </p>

            <h3>3. Privacy</h3>
            <ul>
              <li>Being a part of this group requires mutual trust.</li>
              <li>Confidential and personal information may be shared by our members which may be sensitive.</li>
              <li>
                Authentic, expressive discussions and healthy debates make groups interactive and informative but may
                be sensitive and private.
              </li>
              <li>
                What&rsquo;s shared in the group should stay in the group and never shared with anyone outside the groups
                and not circulated.
              </li>
            </ul>

            <h3>4. Keep It Relevant</h3>
            <ul>
              <li>Use dedicated groups for business, events, sports, or selling personal items.</li>
              <li>Irrelevant posts may be deleted, and repeat offenders removed.</li>
            </ul>

            <h3>5. Events</h3>
            <ul>
              <li>All members are expected to behave respectfully at BILD events.</li>
              <li>BILD events are family-friendly unless explicitly stated otherwise.</li>
              <li>Tickets purchased for events are non-refundable unless the event is cancelled by BILD. See the{' '}
                <a href="/refund-policy">Refund Policy</a> for the full position.</li>
              <li>Members who behave disruptively at events may be asked to leave and may have their membership revoked.</li>
            </ul>


            <h2>Business &amp; Advertising Rules</h2>
            <p>
              These rules apply whenever you promote a business, service or offer anywhere in the BILD community,
              including in the WhatsApp groups and in the Business Directory. Full directory terms are set out in
              section 9 of our <a href="/terms">Terms &amp; Conditions</a>.
            </p>
            <h3>6. Advertising &amp; Marketing</h3>
            <p>
              No spamming, advertising, or any other activities affiliated to anyone within or outside the group are
              allowed without prior admin approval. Any such posts may be deleted.
            </p>
            <p>
              Promotion of any external non-BILD events is not permitted, and any such posts may be deleted.
            </p>
            <p>
              BILD is keen to support member businesses and allow your businesses to promote themselves, provided
              there is a BILD discount or other benefit offered to our BILD members (which will be a condition for
              approval).
            </p>
            <p>
              To prevent our groups from being clogged with advertising posts, we have a dedicated Business Collective
              and LinkedIn Group. Alternatively, you can join &ldquo;BILD Business Mondays&rdquo; on Instagram, please contact
              admin for more info.
            </p>

            <h3>7. Business Directory</h3>
            <ul>
              <li>The directory is open to BILD members and non-BILD businesses alike, at different listing rates.</li>
              <li>Businesses must hold a valid UAE trade licence or a valid UK business registration to be listed.</li>
              <li>UK-registered businesses may only transact for services delivered in the UK, not for services provided within the UAE.</li>
              <li>Business listings must be accurate and up to date.</li>
              <li>BILD does not endorse or take responsibility for the services listed in the directory.</li>
              <li>Misleading or fraudulent business listings will result in removal and potential membership revocation.</li>
            </ul>


            <h2>Enforcement</h2>
            <p>
              Breaches of these rules will be handled by the BILD administrators. Depending on the severity,
              consequences may include a warning, temporary suspension, or permanent removal from the community.
              Decisions made by the BILD administrators are final.
            </p>

            <h2>Final Message</h2>
            <p>
              At BILD, we are more than just a community, we are a family built on trust, kindness, and shared
              experiences. Let&rsquo;s continue to grow stronger together, celebrating our culture and supporting one
              another as we navigate life in UAE.
            </p>
            <p>
              Be kind and supportive, act responsibly, keep it light, and remember, we&rsquo;re all in the same boat
              looking to make like-minded friends!
            </p>
            <p>
              Thank you for your cooperation and understanding and for being part of this incredible journey!
            </p>
          </article>
        </div>
      </div>
    </>
  )
}
