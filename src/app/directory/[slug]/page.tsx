import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Globe, Phone, Mail, MapPin, ShieldCheck, Briefcase, CalendarDays, FileDown } from 'lucide-react'
import { FaWhatsapp, FaInstagram, FaLinkedin } from 'react-icons/fa'
import { supabaseRead } from '@/lib/supabase-admin'
import BusinessAvatar from '@/components/directory/BusinessAvatar'
import BusinessBanner from '@/components/directory/BusinessBanner'
import BusinessInstagram from '@/components/directory/BusinessInstagram'
import CopyLinkButton from './CopyLinkButton'
import { UK_TRANSACT_WARNING } from '../DirectoryClient'
import { formatMemberSince } from '@/lib/format-member-since'
import BusinessGoogleReviews from '@/components/directory/BusinessGoogleReviews'
import BusinessGoogleRatingSummary from '@/components/directory/BusinessGoogleRatingSummary'
import BusinessTestimonials from '@/components/directory/BusinessTestimonials'
import TrackedLink from '@/components/directory/TrackedLink'
import ViewTracker from '@/components/directory/ViewTracker'
import { parseInstagramHandle } from '@/lib/instagram'
import { imageHasTransparency } from '@/lib/image-transparency'

// Prerendered and rebuilt on a 30-minute timer, rather than rendered on every
// request.
//
// It was force-dynamic for one reason: incrementing the view counter during
// the server render. That meant a full React render for every visitor and
// every crawler, on all 34 profiles, to add 1 to a number - which on
// usage-based pricing is the most expensive way to count anything. Views are
// now recorded by ViewTracker from the browser instead, and the page is served
// from cache.
//
// Admin edits do not wait for the timer: the routes that change a listing call
// revalidatePublic(directoryPaths()), which invalidates every profile at once.
export const revalidate = 1800

// Deduped per request with React's cache(): generateMetadata and the page body
// both need the business, and without this each render ran the query twice.
// Prerender every live listing at build time. Without this the first visitor
// to each profile still pays for a full render; with it, all 34 are built once
// and then served from cache until the timer or an admin edit rebuilds them.
//
// dynamicParams stays on (the default), so a business approved after the last
// build still resolves - it renders once on first request, then caches.
export async function generateStaticParams() {
  const nowIso = new Date().toISOString()
  const { data } = await supabaseRead
    .from('business_submissions')
    .select('slug')
    .eq('status', 'approved')
    .is('delisted_at', null)
    .or(`listing_fee_exempt.eq.true,listing_paid_until.gte.${nowIso}`)
  return (data || []).filter(b => b.slug).map(b => ({ slug: b.slug as string }))
}

// supabaseRead, not supabaseAdmin. The admin client wraps fetch with
// cache: 'no-store', which opts the whole route into per-request rendering
// however this page is configured - it is what kept the profile dynamic even
// after revalidate was set. A directory listing is public data that tolerates
// half an hour of staleness, and admin edits revalidate it immediately anyway.
const getBusiness = cache(async function getBusiness(slug: string) {
  const nowIso = new Date().toISOString()
  const { data } = await supabaseRead
    .from('business_submissions')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'approved')
    .is('delisted_at', null)
    .or(`listing_fee_exempt.eq.true,listing_paid_until.gte.${nowIso}`)
    .maybeSingle()
  return data
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const biz = await getBusiness(slug)
  if (!biz) return { title: 'Business' }
  const description = biz.tagline || biz.description?.slice(0, 155) || `${biz.business_name} - a business listed in the BILD Business Directory.`
  const images = biz.logo_url && biz.logo_url.startsWith('http') ? [biz.logo_url] : undefined
  return {
    title: biz.business_name,
    description,
    openGraph: { title: biz.business_name, description, images },
    twitter: { title: biz.business_name, description, images },
  }
}

function waLink(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${digits}`
}

export default async function BusinessProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const biz = await getBusiness(slug)
  if (!biz) notFound()

  const country: 'UAE' | 'UK' = biz.business_country === 'UK' ? 'UK' : 'UAE'
  const verified = !!biz.document_url
  const isFeaturedActive = !!biz.featured && (biz.featured_paid_until == null || new Date(biz.featured_paid_until) >= new Date())
  const isNonMember = biz.is_bild_member === false

  const socialIconSize = isFeaturedActive ? 24 : 18
  // The instagram column may hold a handle, an @handle, or a full URL.
  const instagramProfile = parseInstagramHandle(biz.instagram)
  // Banner backdrop: an explicit admin choice wins, otherwise fall back to
  // detecting transparency. Detection is skipped entirely when overridden, so
  // an override also avoids the extra image request.
  const bannerIsTransparent =
    biz.banner_bg === 'light' ? true
    : biz.banner_bg === 'dark' ? false
    : await imageHasTransparency(biz.banner_url)

  // Per-listing structured data - each business gets its own LocalBusiness
  // entity so search/answer engines can index it individually, not just as
  // an anonymous row inside the directory page.
  const businessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: biz.business_name,
    description: biz.tagline || biz.description || undefined,
    image: biz.logo_url || undefined,
    url: `https://www.bild.ae/directory/${biz.slug}`,
    telephone: biz.phone || undefined,
    email: biz.email || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: biz.location || undefined,
      addressCountry: country === 'UK' ? 'GB' : 'AE',
    },
    sameAs: [biz.website, instagramProfile?.profileUrl, biz.linkedin].filter(Boolean),
  }

  return (
    <>
      <ViewTracker businessId={biz.id} />
      <div className="py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/directory" className="inline-flex items-center gap-2 text-charcoal-600 hover:text-gold-600 mb-8 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Directory
        </Link>

        <BusinessBanner name={biz.business_name} bannerUrl={biz.banner_url || undefined} transparent={bannerIsTransparent} />

        <div className="flex items-start gap-4 sm:gap-5 mb-4">
          <BusinessAvatar name={biz.business_name} logoUrl={biz.logo_url || undefined} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-charcoal-800">{biz.business_name}</h1>
              <span aria-label={country === 'UK' ? 'UK-registered business' : 'UAE-registered business'}>
                {country === 'UK' ? '🇬🇧' : '🇦🇪'}
              </span>
              {isNonMember && (
                <span className="inline-flex items-center bg-charcoal-100 text-charcoal-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  Non-BILD Business
                </span>
              )}
              {isFeaturedActive && (
                <span className="inline-flex items-center bg-gold-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  ⭐ Featured
                </span>
              )}
            </div>
            <p className="text-charcoal-500">{biz.owner_name}</p>
            <span className="inline-block bg-gold-100 text-gold-700 text-xs font-medium px-2.5 py-0.5 rounded-full mt-1.5">
              {biz.category}
            </span>
            {/* Star rating up here as well as in the full reviews section lower
                down, so it is visible without scrolling. */}
            {biz.google_place_id && (
              <div>
                <BusinessGoogleRatingSummary placeId={biz.google_place_id} />
              </div>
            )}
          </div>
        </div>

        {biz.tagline && <p className="text-lg font-medium text-charcoal-700 mb-4">{biz.tagline}</p>}

        {(verified || biz.established_year || country === 'UK') && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {verified && (
              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-full">
                <ShieldCheck size={12} /> Registration Checked
              </span>
            )}
            {biz.established_year && (
              <span className="inline-flex items-center gap-1 text-xs text-charcoal-500">
                <Briefcase size={12} className="text-gold-500" /> Trading since {biz.established_year}
              </span>
            )}
            {country === 'UK' && (
              <span className="inline-flex items-center gap-1 text-xs text-charcoal-400 italic">
                {UK_TRANSACT_WARNING}
              </span>
            )}
          </div>
        )}

        {/* States plainly what the badge does and does not mean. "Verified"
            previously risked reading as BILD vouching for the business, which
            contradicts the directory disclaimer. */}
        {verified && (
          <p className="text-xs text-charcoal-500 bg-cream border border-gold-100 rounded-lg px-3 py-2 mb-6 leading-relaxed">
            BILD has received and checked documentation showing the business holds the stated
            {country === 'UK' ? ' UK business registration' : ' UAE trade licence'}. This does not constitute an
            endorsement or guarantee of the business, its services or its regulatory status.
          </p>
        )}

        <p className="text-charcoal-600 leading-relaxed mb-6 whitespace-pre-line">{biz.description}</p>

        {isFeaturedActive && biz.featured_bio && (
          <p className="text-charcoal-600 leading-relaxed mb-6 whitespace-pre-line">{biz.featured_bio}</p>
        )}

        {isFeaturedActive && biz.featured_gallery_urls?.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {biz.featured_gallery_urls.map((url: string) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
            ))}
          </div>
        )}

        {isFeaturedActive && biz.featured_video_url && (
          <div className="mb-6 rounded-xl overflow-hidden aspect-video">
            <iframe
              src={biz.featured_video_url.replace('watch?v=', 'embed/')}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Featured only. A lapsed Featured listing keeps the file stored but
            stops offering it, exactly as it does with the gallery and video. */}
        {isFeaturedActive && biz.featured_brochure_url && (
          <TrackedLink
            businessId={biz.id}
            kind="click_brochure"
            href={biz.featured_brochure_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white border border-gold-200 hover:border-gold-400 hover:bg-gold-50 rounded-xl px-4 py-3 mb-6 transition-colors group"
          >
            <span className="w-10 h-10 rounded-lg bg-gold-100 flex items-center justify-center shrink-0">
              <FileDown size={20} className="text-gold-600" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-charcoal-800 group-hover:text-gold-700">Download our brochure</span>
              <span className="block text-xs text-charcoal-500 truncate">{biz.featured_brochure_name || 'PDF brochure'}</span>
            </span>
          </TrackedLink>
        )}

        {isFeaturedActive && biz.featured_offers?.length > 0 ? (
          <div className="bg-gold-50 border border-gold-200 rounded-xl px-4 py-3 mb-6">
            <p className="text-sm font-semibold text-gold-700 mb-1">🎁 BILD Member Offers</p>
            <ul className="space-y-1">
              {biz.featured_offers.map((offer: string) => (
                <li key={offer} className="text-sm text-charcoal-600">{offer}</li>
              ))}
            </ul>
          </div>
        ) : biz.bild_offer && (
          <div className="bg-gold-50 border border-gold-200 rounded-xl px-4 py-3 mb-6">
            <p className="text-sm font-semibold text-gold-700">🎁 BILD Member Offer</p>
            <p className="text-sm text-charcoal-600 mt-1">{biz.bild_offer}</p>
          </div>
        )}

        {biz.extra_info && (
          <p className="text-sm text-charcoal-600 mb-6 whitespace-pre-line">{biz.extra_info}</p>
        )}

        <p className="flex items-center gap-1.5 text-sm text-charcoal-500 mb-2">
          <MapPin size={14} /> {biz.location}
        </p>
        {(() => {
          const memberSince = formatMemberSince(biz.bild_member_since || biz.created_at?.slice(0, 7))
          return memberSince && (
            <p className="flex items-center gap-1.5 text-sm text-charcoal-400 mb-6">
              <CalendarDays size={14} /> BILD member since {memberSince}
            </p>
          )
        })()}

        <div className="flex items-center gap-3 flex-wrap pt-6 border-t border-gold-200">
          {biz.phone && (
            <TrackedLink
              businessId={biz.id}
              kind="click_whatsapp"
              href={waLink(biz.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#25D366] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1da851] transition-colors"
            >
              <FaWhatsapp size={16} /> WhatsApp
            </TrackedLink>
          )}
          {biz.email && (
            <TrackedLink businessId={biz.id} kind="click_email" href={`mailto:${biz.email}`} className="text-charcoal-500 hover:text-gold-600 transition-colors" title="Email">
              <Mail size={socialIconSize} />
            </TrackedLink>
          )}
          {biz.phone && (
            <TrackedLink businessId={biz.id} kind="click_phone" href={`tel:${biz.phone}`} className="text-charcoal-500 hover:text-gold-600 transition-colors" title="Call">
              <Phone size={socialIconSize} />
            </TrackedLink>
          )}
          {biz.website && (
            <TrackedLink businessId={biz.id} kind="click_website" href={biz.website} target="_blank" rel="noopener noreferrer" className="text-charcoal-500 hover:text-gold-600 transition-colors" title="Website">
              <Globe size={socialIconSize} />
            </TrackedLink>
          )}
          {instagramProfile && (
            <TrackedLink businessId={biz.id} kind="click_instagram" href={instagramProfile.profileUrl} target="_blank" rel="noopener noreferrer" className="text-charcoal-500 hover:text-[#E1306C] transition-colors" title="Instagram">
              <FaInstagram size={socialIconSize} />
            </TrackedLink>
          )}
          {biz.linkedin && (
            <a href={biz.linkedin} target="_blank" rel="noopener noreferrer" className="text-charcoal-500 hover:text-[#0A66C2] transition-colors" title="LinkedIn">
              <FaLinkedin size={socialIconSize} />
            </a>
          )}
          <CopyLinkButton />
        </div>

        {/* Hides itself when the business has none approved. */}
        <BusinessTestimonials businessId={biz.id} businessName={biz.business_name} />

        <BusinessInstagram
          instagram={biz.instagram}
          postUrl={biz.instagram_post_url}
          businessName={biz.business_name}
        />

        {biz.google_place_id && <BusinessGoogleReviews placeId={biz.google_place_id} />}
      </div>
    </div>
    </>
  )
}
