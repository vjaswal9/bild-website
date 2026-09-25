import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Users, Store, PartyPopper, Handshake, Newspaper } from 'lucide-react'
import { FaInstagram, FaFacebookF, FaLinkedinIn } from 'react-icons/fa'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import Reveal from '@/components/anim/Reveal'
import { getGoogleReviews } from '@/lib/google-reviews'
import { SITE_CONFIG } from '@/data/config'

// Same timer as every other page showing the Google rating badge, so the
// review count never disagrees between pages.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with BILD (British Indians Living in Dubai). Contact us about membership, listing a business, sponsoring an event, partnering with us, or a press enquiry.',
}

// Most people arriving here want one of a handful of things, and for several
// of them there is already a form that gets them a faster answer than email.
// Pointing them there first is more useful than an inbox.
const routes = [
  {
    icon: Users,
    title: 'Joining BILD',
    body: 'Membership is a one-off fee and the application takes about two minutes.',
    href: '/join',
    cta: 'Apply to join',
  },
  {
    icon: Store,
    title: 'Listing your business',
    body: 'Open to BILD members and non-members. Submitting a listing is free.',
    href: '/directory/submit',
    cta: 'List your business',
  },
  {
    icon: PartyPopper,
    title: 'Events and tickets',
    body: 'Dates, tickets and what is coming up next. For anything about a booking, email events@bild.ae.',
    href: '/events',
    cta: 'See events',
  },
]

const enquiries = [
  {
    icon: Handshake,
    title: 'Sponsorship and partnerships',
    body: 'Reaching 2,000+ British Indians across the UAE, at an event or across the community.',
  },
  {
    icon: Newspaper,
    title: 'Press and media',
    body: 'Interviews, comment, or background on the British Indian community in the UAE.',
  },
  {
    icon: Store,
    title: 'Venues and suppliers',
    body: 'Hosting or catering a BILD event, from a coffee morning to a Diwali night.',
  },
]

export default async function ContactPage() {
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="Contact BILD" subtitle="However you found us, we would love to hear from you">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>

      {/* ---- The one address ---- */}
      <section className="py-16 bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <span className="w-14 h-14 rounded-2xl bg-gold-100 flex items-center justify-center mx-auto mb-5">
              <Mail size={24} className="text-gold-600" />
            </span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-charcoal-800 mb-3">
              Email us
            </h2>
            <a
              href={`mailto:${SITE_CONFIG.contactEmail}`}
              className="font-display text-2xl md:text-3xl text-gold-600 hover:underline break-all"
            >
              {SITE_CONFIG.contactEmail}
            </a>
            <p className="text-charcoal-600 mt-5 leading-relaxed max-w-xl mx-auto">
              One address for everything. It reaches the BILD team directly, and we aim to reply within two working
              days. BILD is run by people who have jobs and families too, so please bear with us at busy times.
            </p>
          </Reveal>

          <Reveal className="flex justify-center gap-3 mt-8" stagger={0.08} y={16}>
            {[
              { href: SITE_CONFIG.instagramUrl, label: 'Instagram', Icon: FaInstagram },
              { href: SITE_CONFIG.facebookUrl, label: 'Facebook', Icon: FaFacebookF },
              { href: SITE_CONFIG.linkedinUrl, label: 'LinkedIn', Icon: FaLinkedinIn },
            ].map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-11 h-11 rounded-full bg-white border border-gold-200 flex items-center justify-center text-charcoal-600 hover:bg-gold-500 hover:text-white hover:border-gold-500 transition-all"
              >
                <Icon size={18} />
              </a>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ---- Faster than email ---- */}
      <section className="py-16 bg-gold-50 border-y border-gold-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-charcoal-800 mb-2">
              Quicker than emailing us
            </h2>
            <p className="text-charcoal-600">
              For these three, the form gets you an answer faster than we can.
            </p>
          </Reveal>

          <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-5" stagger={0.1} y={24}>
            {routes.map(r => {
              const Icon = r.icon
              return (
                <div key={r.title} className="flex flex-col bg-white rounded-2xl border border-gold-200 p-6">
                  <span className="w-10 h-10 rounded-lg bg-gold-100 flex items-center justify-center mb-4">
                    <Icon size={19} className="text-gold-600" />
                  </span>
                  <h3 className="font-semibold text-charcoal-800 mb-1.5">{r.title}</h3>
                  <p className="text-charcoal-600 text-sm leading-relaxed flex-1 mb-4">{r.body}</p>
                  <Link href={r.href} className="text-gold-700 font-semibold text-sm hover:underline">
                    {r.cta} &rarr;
                  </Link>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      {/* ---- Everything else ---- */}
      <section className="py-16 bg-cream">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-charcoal-800 mb-2">
              Working with BILD
            </h2>
            <p className="text-charcoal-600 max-w-xl mx-auto">
              Email us with a line about what you have in mind and we will come back to you.
            </p>
          </Reveal>

          <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-5" stagger={0.1} y={24}>
            {enquiries.map(e => {
              const Icon = e.icon
              return (
                <div key={e.title} className="bg-white rounded-2xl border border-gold-200 p-6">
                  <span className="w-10 h-10 rounded-lg bg-charcoal-800 flex items-center justify-center mb-4">
                    <Icon size={19} className="text-gold-400" />
                  </span>
                  <h3 className="font-semibold text-charcoal-800 mb-1.5">{e.title}</h3>
                  <p className="text-charcoal-600 text-sm leading-relaxed">{e.body}</p>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      {/* ---- Who you are dealing with ---- */}
      <section className="py-14 bg-charcoal-800">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="font-display text-xl font-bold text-white mb-3">Who you are dealing with</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            BILD operates as B.I.L.D AE Events Organizing &amp; Managing, licensed by the Dubai Department of Economy
            and Tourism. Founded in Dubai in 2019 and now more than 2,000 members across the UAE.
          </p>
          <p className="text-gray-500 text-xs mt-4 leading-relaxed">
            For anything about your personal information see our <Link href="/privacy" className="text-gold-400 hover:underline">Privacy Policy</Link>,
            for refunds see our <Link href="/refund-policy" className="text-gold-400 hover:underline">Refund Policy</Link>,
            and for the rules of membership see our <Link href="/terms" className="text-gold-400 hover:underline">Terms and Conditions</Link>.
          </p>
        </div>
      </section>
    </>
  )
}
