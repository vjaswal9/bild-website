import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normaliseInstagramHandle } from '@/lib/instagram'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { normalizeWebsiteUrl, stripDashes } from '@/lib/utils'
import { resolvePlaceIdFromGoogleUrl } from '@/lib/google-reviews'
import { revalidatePublic, directoryPaths } from '@/lib/revalidate-public'

export const dynamic = 'force-dynamic'

// Fields an admin is allowed to edit on a business submission.
const EDITABLE = [
  'business_name',
  'owner_name',
  'category',
  'tagline',
  'description',
  'location',
  'phone',
  'email',
  'website',
  'instagram',
  'linkedin',
  'google_maps_url',
  'google_place_id',
  'established_year',
  'bild_member_since',
  'years_in_business',
  'bild_offer',
  'extra_info',
  'logo_url',
  'banner_url',
  'banner_bg',
  'instagram_post_url',
  'business_country',
  'document_expiry_date',
  'slug',
  'listing_fee_exempt',
  'listing_paid_until',
  'membership_manually_verified',
] as const

export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (key in body) {
      const v = body[key]
      if (key === 'instagram') {
        // Accept a handle, @handle or a pasted profile URL - always store a
        // bare handle so links are built correctly.
        update[key] = normaliseInstagramHandle(typeof v === 'string' ? v : null)
      } else if ((key === 'website' || key === 'logo_url' || key === 'linkedin') && typeof v === 'string') {
        update[key] = normalizeWebsiteUrl(v)
      } else if (key === 'document_expiry_date' || key === 'listing_paid_until') {
        update[key] = typeof v === 'string' && v.trim() ? v.trim() : null
      } else if (key === 'listing_fee_exempt' || key === 'membership_manually_verified') {
        update[key] = v === true || v === 'true'
      } else {
        update[key] = typeof v === 'string' ? stripDashes(v.trim()) : v
      }
    }
  }

  // If the review link changed and the admin didn't also fill in a Place ID
  // manually (the edit form always sends this field, blank or not - a blank
  // value means "no override"), re-resolve it. A non-empty google_place_id
  // in the body is treated as a manual override and takes precedence.
  if ('google_maps_url' in update && !(typeof body.google_place_id === 'string' && body.google_place_id.trim())) {
    const url = update.google_maps_url as string | null
    update.google_place_id = url ? await resolvePlaceIdFromGoogleUrl(url).catch(() => null) : null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('business_submissions')
    .update(update)
    .eq('id', body.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePublic(directoryPaths())
  return NextResponse.json({ ok: true })
}
