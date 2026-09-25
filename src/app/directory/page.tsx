import type { Metadata } from 'next'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import SectionHeading from '@/components/ui/SectionHeading'
import FAQSection from '@/components/ui/FAQSection'
import DirectoryClient, { DisplayBusiness } from './DirectoryClient'
import { supabaseRead } from '@/lib/supabase-admin'
import { getGoogleReviews } from '@/lib/google-reviews'
import { LISTING_MEMBER_FEE_AED, LISTING_NON_MEMBER_FEE_AED, LISTING_GRACE_LABEL, FEATURED_MEMBER_FEE_AED, FEATURED_NON_MEMBER_FEE_AED } from '@/lib/featured-copy'

export const metadata: Metadata = {
  title: 'Business Directory',
  description: 'Find British Indian businesses and professionals in Dubai, the UAE, and the UK, listed in the BILD Business Directory.',
}

// Rebuilt every five minutes rather than per request. Newly approved listings
// appear within that window, which is well inside the time it takes to review
// and approve one.
export const revalidate = 300

export default async function DirectoryPage() {
  // Every listing comes from approved submissions in Supabase. Visibility is
  // additionally gated by the listing fee: comped businesses (listing_fee_exempt)
  // are always shown, everyone else needs a future listing_paid_until.
  const nowIso = new Date().toISOString()
  const { data: supabaseApproved } = await supabaseRead
    .from('business_submissions')
    .select('*')
    .eq('status', 'approved')
    .is('delisted_at', null)
    .or(`listing_fee_exempt.eq.true,listing_paid_until.gte.${nowIso}`)
    .order('reviewed_at', { ascending: false })

  const bildGoogleReviews = await getGoogleReviews()

  const googleReviewsByBusiness = new Map(
    await Promise.all(
      (supabaseApproved || [])
        .filter(b => b.google_place_id)
        .map(async b => [b.id, await getGoogleReviews(b.google_place_id)] as const)
    )
  )

  const businesses: DisplayBusiness[] = (supabaseApproved || []).map(b => ({
    id: b.id,
    name: b.business_name,
    ownerName: b.owner_name,
    category: b.category,
    description: b.description,
    contactEmail: b.email,
    contactPhone: b.phone,
    website: b.website || undefined,
    instagram: b.instagram || undefined,
    linkedin: b.linkedin || undefined,
    location: b.location,
    isVerified: true,
    bildOffer: b.bild_offer || undefined,
    logoUrl: b.logo_url || undefined,
    memberSince: b.bild_member_since || (b.created_at ? b.created_at.slice(0, 7) : undefined),
    tagline: b.tagline || undefined,
    establishedYear: b.established_year || undefined,
    // An approved submission with a document on file is verified
    licenceVerified: !!b.document_url,
    country: b.business_country || 'UAE',
    slug: b.slug || undefined,
    featured: b.featured || false,
    isBildMember: b.is_bild_member !== false,
    googleRating: googleReviewsByBusiness.get(b.id)?.rating,
    googleReviewCount: googleReviewsByBusiness.get(b.id)?.totalReviews,
  }))

  return (
    <>
      {/* No dark PageHero here. The directory's own hero is the page's opening
          statement, and stacking a second title above it pushed the search box
          below the fold on every laptop. */}
      <DirectoryClient
        businesses={businesses}
        googleBadge={
          bildGoogleReviews && (
            <GoogleRatingBadge
              rating={bildGoogleReviews.rating}
              totalReviews={bildGoogleReviews.totalReviews}
              mapsUrl={bildGoogleReviews.mapsUrl}
              tone="light"
              align="left"
            />
          )
        }
      />

      <section className="py-20 bg-cream border-t border-gold-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Frequently Asked Questions" subtitle="About the BILD Business Directory" />
          <FAQSection
            faqs={[
              {
                q: 'Who can list a business in the BILD directory?',
                a: 'The directory is open to both BILD members and non-BILD businesses. Members list at a discounted rate; non-members list at a standard rate.',
              },
              {
                q: 'How much does it cost to list my business?',
                a: `BILD members pay ${LISTING_MEMBER_FEE_AED} AED/year (free for BILD members until ${LISTING_GRACE_LABEL}); non-BILD businesses pay ${LISTING_NON_MEMBER_FEE_AED} AED/year. Submitting your listing for review is always free - payment is only requested after approval.`,
              },
              {
                q: 'What does the Registration Checked badge mean?',
                a: 'It means BILD has received and checked documentation showing the business holds the stated UAE trade licence or UK business registration. It does not constitute an endorsement or guarantee of the business, its services or its regulatory status, and BILD does not check the quality of any work carried out. Please do your own checks before engaging any business.',
              },
              {
                q: 'What is Featured placement?',
                a: `Featured businesses get gold-highlighted, boosted visibility in the directory plus a richer profile page with an extended bio, photo gallery, video, and multiple member offers. It costs ${FEATURED_MEMBER_FEE_AED} AED/quarter for members or ${FEATURED_NON_MEMBER_FEE_AED} AED/quarter for non-members, and can be added any time after your listing is approved.`,
              },
              {
                q: 'Can UK-registered businesses be listed?',
                a: 'Yes. Both UAE-licensed and UK-registered businesses may be listed. UK-registered businesses may only transact for services delivered in the UK, not within the UAE.',
              },
            ]}
          />
        </div>
      </section>
    </>
  )
}
