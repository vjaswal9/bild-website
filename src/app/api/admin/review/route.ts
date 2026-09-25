import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendBusinessRejection, sendBusinessApprovedEmail, sendListingActivationEmail } from '@/lib/email'
import { googleReviewsLinkFor } from '@/lib/google-reviews-link'
import { LISTING_GRACE_CUTOFF, LISTING_MEMBER_FEE_AED, LISTING_NON_MEMBER_FEE_AED } from '@/lib/featured-copy'
import { revalidatePublic, directoryPaths } from '@/lib/revalidate-public'

export async function POST(req: NextRequest) {
  // Verify admin session
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, action, admin_notes } = await req.json().catch(() => ({}))

  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // A reason is required when rejecting, since it's emailed to the business.
  if (action === 'rejected' && !String(admin_notes || '').trim()) {
    return NextResponse.json({ error: 'Please enter a reason for rejection.' }, { status: 400 })
  }

  // Every approval also gets a standing self-serve "Become Featured" token,
  // regardless of which listing-fee path it takes below.
  const featuredToken = randomUUID().replace(/-/g, '')

  const update: Record<string, unknown> = {
    status: action,
    admin_notes: admin_notes || null,
    reviewed_at: new Date().toISOString(),
  }

  let listingToken: string | null = null
  // The free-until date to mention in the welcome email, when there is one
  // (permanent comps via listing_fee_exempt have no date to show).
  let freeUntilDate: string | null = null
  if (action === 'approved') {
    update.featured_payment_token = featuredToken

    const { data: bizRow } = await supabaseAdmin
      .from('business_submissions')
      .select('is_bild_member, listing_fee_exempt, listing_paid_until')
      .eq('id', id)
      .single()

    const inGracePeriod = !!bizRow?.is_bild_member && new Date() < new Date(LISTING_GRACE_CUTOFF)
    // An admin may have already comped this business before approving it -
    // either permanently ("Comp this listing") or with a custom free-until
    // date via the manual override field. Either one skips the payment step
    // here too, so the business gets the free welcome email instead of a
    // request to pay for something it doesn't actually owe.
    const alreadyComped = !!bizRow?.listing_fee_exempt ||
      (!!bizRow?.listing_paid_until && new Date(bizRow.listing_paid_until) >= new Date())

    if (inGracePeriod) {
      update.listing_paid_until = LISTING_GRACE_CUTOFF
      freeUntilDate = LISTING_GRACE_CUTOFF
    } else if (alreadyComped) {
      // Leave listing_fee_exempt / listing_paid_until exactly as the admin
      // already set them - nothing to change here, just skip the paywall.
      // Only a custom free-until date (not a permanent exemption) has a
      // date worth mentioning in the welcome email.
      if (!bizRow?.listing_fee_exempt && bizRow?.listing_paid_until) {
        freeUntilDate = bizRow.listing_paid_until
      }
    } else {
      listingToken = randomUUID().replace(/-/g, '')
      update.listing_payment_token = listingToken
      update.listing_payment_token_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  const { data, error } = await supabaseAdmin
    .from('business_submissions')
    .update(update)
    .eq('id', id)
    .select('business_name, owner_name, email, slug, is_bild_member, google_place_id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (action === 'rejected' && data?.email) {
    try {
      await sendBusinessRejection({
        to: data.email,
        businessName: data.business_name,
        ownerName: data.owner_name,
        reason: String(admin_notes).trim(),
      })
    } catch (e) {
      console.error('Business rejection email failed:', e)
    }
  }

  if (action === 'approved' && data?.email && data?.slug) {
    const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
    const base = process.env.NEXT_PUBLIC_SITE_URL || origin
    const featuredUrl = `${base}/directory/feature/${featuredToken}`

    try {
      if (listingToken) {
        const feeAed = data.is_bild_member ? LISTING_MEMBER_FEE_AED : LISTING_NON_MEMBER_FEE_AED
        await sendListingActivationEmail({
          to: data.email,
          businessName: data.business_name,
          ownerName: data.owner_name,
          feeAed,
          payUrl: `${base}/directory/pay/${listingToken}`,
          featuredUrl,
        })
      } else {
        await sendBusinessApprovedEmail({
          to: data.email,
          businessName: data.business_name,
          ownerName: data.owner_name,
          profileUrl: `${base}/directory/${data.slug}`,
          featuredUrl,
          freeUntil: freeUntilDate ? new Date(freeUntilDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null,
          // A business that did not add Google reviews when applying can do it from here.
          googleReviewsUrl: data.google_place_id ? null : await googleReviewsLinkFor(String(id)),
        })
      }
    } catch (e) {
      console.error('Business approved email failed:', e)
    }
  }

  revalidatePublic(directoryPaths())
  return NextResponse.json({ ok: true })
}
