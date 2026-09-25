import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normaliseEmail } from '@/lib/email-validate'
import { normaliseInstagramHandle } from '@/lib/instagram'
import { sendNewBusinessAlert } from '@/lib/email'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { resolvePlaceIdFromGoogleUrl } from '@/lib/google-reviews'
import { stripDashes } from '@/lib/utils'
import { str, httpUrl } from '@/lib/validate'
import { isVerifiedMemberContact } from '@/lib/member-match'

export const dynamic = 'force-dynamic'

const RESERVED_SLUGS = new Set(['submit', 'renew'])

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'business'
}

// Public endpoint: the directory "submit your business" form posts here.
// Files (logo, licence/document) are uploaded to Storage by the client
// beforehand; this route only inserts the record and alerts the admin team.
export async function POST(req: NextRequest) {
  if (isRateLimited(`business-submit:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !body.business_name || !body.email || !body.owner_name) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const businessCountry = body.business_country === 'UK' ? 'UK' : 'UAE'

  // Generate a unique, shareable slug from the business name.
  let slug = slugify(body.business_name)
  const { data: existing } = await supabaseAdmin
    .from('business_submissions')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing || RESERVED_SLUGS.has(slug)) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`
  }

  // Best-effort - never blocks submission if the link doesn't resolve.
  let googlePlaceId: string | null = null
  if (body.google_maps_url) {
    try {
      googlePlaceId = await resolvePlaceIdFromGoogleUrl(String(body.google_maps_url))
    } catch (e) {
      console.error('Google Place ID resolution failed:', e)
    }
  }

  // Every free-text field is capped. These are written straight to the
  // database and later rendered on a public profile page, and several had no
  // length limit at all, so a single submission could store an unbounded wall
  // of text. The caps are generous enough that no genuine listing will notice.
  const payload = {
    business_name: stripDashes(str(body.business_name, 120)),
    category: str(body.category, 60),
    tagline: stripDashes(str(body.tagline, 160)) || null,
    description: stripDashes(str(body.description, 4000)),
    location: str(body.location, 120),
    owner_name: str(body.owner_name, 120),
    phone: str(body.phone, 40),
    email: str(body.email, 200),
    website: httpUrl(body.website) || null,
    // Stored as a bare handle whatever the person typed - handle, @handle,
    // profile URL, or a share link with tracking parameters.
    instagram: normaliseInstagramHandle(body.instagram),
    linkedin: httpUrl(body.linkedin) || null,
    google_maps_url: body.google_maps_url || null,
    google_place_id: googlePlaceId,
    logo_url: body.logo_url || null,
    banner_url: body.banner_url || null,
    established_year: body.established_year || null,
    bild_member_since: body.bild_member_since || null,
    bild_offer: stripDashes(str(body.bild_offer, 500)) || null,
    extra_info: stripDashes(str(body.extra_info, 2000)) || null,
    business_country: businessCountry,
    is_bild_member: body.is_bild_member !== false,
    document_url: body.document_url || null,
    document_expiry_date: body.document_expiry_date || null,
    slug,
    status: 'pending',
  }

  const { error } = await supabaseAdmin.from('business_submissions').insert([payload])
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Only actually-paid members count as "verified" - flags a claimed BILD
  // membership that doesn't match anyone, right in the admin alert.
  let membershipUnverified = false
  if (payload.is_bild_member) {
    const { data: members } = await supabaseAdmin.from('members').select('email, phone').eq('status', 'paid')
    membershipUnverified = !isVerifiedMemberContact({ email: payload.email, phone: payload.phone }, members || [])
  }

  // Don't let an email hiccup fail the submission.
  try {
    await sendNewBusinessAlert({
      businessName: payload.business_name,
      category: payload.category,
      ownerName: payload.owner_name,
      email: payload.email,
      phone: payload.phone,
      location: payload.location,
      tagline: payload.tagline,
      country: payload.business_country,
      isBildMember: payload.is_bild_member,
      membershipUnverified,
    })
  } catch (e) {
    console.error('New business alert failed:', e)
  }

  // Close off the lead this application came from, if there was one. Marked
  // rather than deleted, so the weekly digest can report recovered sign-ups
  // the way the membership one does.
  try {
    const { error: leadErr } = await supabaseAdmin
      .from('directory_leads')
      .update({ completed_at: new Date().toISOString() })
      .eq('email', normaliseEmail(body.email))
      .is('completed_at', null)
    if (leadErr) console.error('Could not close the directory lead:', leadErr.message)
  } catch (e) {
    console.error('Could not close the directory lead:', e)
  }

  return NextResponse.json({ ok: true })
}
