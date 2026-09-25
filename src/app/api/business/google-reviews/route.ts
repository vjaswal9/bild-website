import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyGoogleReviewsLinkToken } from '@/lib/admin-auth'
import { resolvePlaceIdFromGoogleUrl, getGoogleReviews } from '@/lib/google-reviews'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { revalidatePublic, directoryPaths } from '@/lib/revalidate-public'
import { sendGoogleReviewsActivatedAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'

// A business adds its own Google review link from its personal page.
//
// The link is checked the moment it is submitted. Only a Google Business
// Profile "Ask for reviews" link lets us find the business's reviews, and the
// three listings that never showed reviews had all sent something else: two
// Google search results pages and a g.co share link. So a link that cannot be
// connected is refused with an explanation of which link to use instead,
// rather than saved and silently showing nothing.

const SHARE_LINK_HELP =
  'Please use the "Ask for reviews" link from your Google Business Profile. It starts with g.page/r/.'

function normalise(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$|^g\.page$|^g\.co$|^goo\.gl$|^maps\.app\.goo\.gl$/i

// The explanation for a Google link we could not connect, matched to the kind
// of link it is, since each wrong kind is found in a different place.
function whyItFailed(u: URL): string {
  const host = u.hostname.replace(/^www\./, '')
  if (/(^|\.)google\./i.test(host) && u.pathname.startsWith('/search')) {
    return `That is a link to Google search results, which we cannot read reviews from. ${SHARE_LINK_HELP}`
  }
  if (/(^|\.)google\./i.test(host) && u.pathname.startsWith('/maps')) {
    return `That is a Google Maps link, which we cannot read reviews from. ${SHARE_LINK_HELP}`
  }
  if (host === 'g.co') {
    return `That is a Google share link for your search listing, which we cannot read reviews from. ${SHARE_LINK_HELP}`
  }
  return `We could not find a Google business from that link. ${SHARE_LINK_HELP}`
}

export async function POST(req: NextRequest) {
  if (isRateLimited(`google-reviews-link:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const businessId = await verifyGoogleReviewsLinkToken(body?.token)
  if (!businessId) {
    return NextResponse.json({ error: 'This link is not valid. Please use the button from your BILD email.' }, { status: 404 })
  }

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, slug, status, delisted_at, google_place_id')
    .eq('id', businessId)
    .maybeSingle()
  if (!biz || biz.status !== 'approved' || biz.delisted_at) {
    return NextResponse.json({ error: 'This listing is not currently live in the directory.' }, { status: 403 })
  }

  const url = normalise(body?.url)
  if (!url) return NextResponse.json({ error: `Please paste your link. ${SHARE_LINK_HELP}` }, { status: 400 })
  if (!GOOGLE_HOST.test(url.hostname.replace(/^www\./, ''))) {
    return NextResponse.json({ error: `That does not look like a Google link. ${SHARE_LINK_HELP}` }, { status: 400 })
  }

  const placeId = await resolvePlaceIdFromGoogleUrl(url.toString())
  if (!placeId) return NextResponse.json({ error: whyItFailed(url) }, { status: 400 })

  // A business with no reviews yet still connects; its rating appears later.
  const reviews = await getGoogleReviews(placeId)

  const { error } = await supabaseAdmin
    .from('business_submissions')
    .update({ google_maps_url: url.toString(), google_place_id: placeId })
    .eq('id', biz.id)
  if (error) return NextResponse.json({ error: 'Could not save your link. Please try again.' }, { status: 500 })

  revalidatePublic(directoryPaths(biz.slug))

  // Only tell the admins about a real change, not a business pressing save twice.
  if (biz.google_place_id !== placeId) {
    await sendGoogleReviewsActivatedAlert({
      businessName: biz.business_name,
      slug: biz.slug,
      rating: reviews ? reviews.rating : null,
      totalReviews: reviews ? reviews.totalReviews : null,
      googleLink: url.toString(),
      replacedExisting: !!biz.google_place_id,
    })
  }

  return NextResponse.json({
    ok: true,
    rating: reviews ? reviews.rating : null,
    totalReviews: reviews ? reviews.totalReviews : null,
    profileUrl: `/directory/${biz.slug}`,
  })
}
