import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendListingActivationEmail } from '@/lib/email'
import { LISTING_MEMBER_FEE_AED, LISTING_NON_MEMBER_FEE_AED } from '@/lib/featured-copy'
import { uuid } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'
const EXPIRY_DAYS = 7

// Sends a business a fresh link to pay for its listing.
//
// Approving a business creates this link and emails it automatically, but the
// link lasts seven days. After that the business is stuck: the payment page
// tells them to ask BILD for a new one, and there was no way for an admin to
// issue one. A listing approved and never paid for simply stayed invisible in
// the directory for ever, with nobody able to do anything about it. Forward
// Air Cargo sat like that from 5 September.
//
// The link is always reissued rather than reused, because the reason for
// pressing this is almost always that the old one has expired. The new one is
// returned to the admin as well, so it can be copied into a WhatsApp message
// if the email does not land.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const id = uuid(body.id)
  if (!id) return NextResponse.json({ error: 'Missing or invalid id.' }, { status: 400 })

  const { data: biz, error: readError } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, owner_name, email, status, is_bild_member, listing_fee_exempt, listing_paid_until')
    .eq('id', id)
    .maybeSingle()

  if (readError) {
    console.error('Could not load a business to send its payment link:', readError)
    return NextResponse.json({ error: 'Could not read the listing just now. Please try again.' }, { status: 503 })
  }
  if (!biz) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  if (biz.status !== 'approved') {
    return NextResponse.json({ error: 'Only approved listings can be sent a payment link.' }, { status: 400 })
  }
  if (!biz.email) {
    return NextResponse.json({ error: 'This listing has no email address to send to.' }, { status: 400 })
  }
  // Asking someone to pay for something they already have is worse than doing
  // nothing, so both ways of already being live are refused.
  if (biz.listing_fee_exempt) {
    return NextResponse.json({ error: 'This listing is comped, so there is nothing to pay.' }, { status: 400 })
  }
  if (biz.listing_paid_until && new Date(biz.listing_paid_until) >= new Date()) {
    return NextResponse.json({ error: 'This listing is already paid for and live.' }, { status: 400 })
  }

  const token = randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error: saveError } = await supabaseAdmin
    .from('business_submissions')
    .update({
      listing_payment_token: token,
      listing_payment_token_expires_at: expiresAt,
      // The reminder chain is restarted with the link, so they get the usual
      // nudges against this new deadline rather than none at all.
      listing_renewal_reminder_sent_at: null,
      listing_final_reminder_sent_at: null,
      listing_expired_notice_sent_at: null,
      // Sending a link by hand is how an admin gives a business another go, so
      // it takes them back out of the "applied but never paid" archive and
      // restarts the automatic chase from the beginning.
      listing_abandoned_at: null,
      listing_activation_reminder_sent_at: null,
    })
    .eq('id', biz.id)

  if (saveError) {
    console.error('Could not save a new listing payment link:', saveError)
    return NextResponse.json({ error: `Could not create the link: ${saveError.message}` }, { status: 500 })
  }

  const payUrl = `${SITE_URL}/directory/pay/${token}`
  const feeAed = biz.is_bild_member ? LISTING_MEMBER_FEE_AED : LISTING_NON_MEMBER_FEE_AED

  await sendListingActivationEmail({
    to: biz.email,
    businessName: biz.business_name,
    ownerName: biz.owner_name,
    feeAed,
    payUrl,
    featuredUrl: `${SITE_URL}/directory/get-featured`,
  })

  // This sender does not report whether the send succeeded, so the response
  // deliberately does not claim it did. A rejected send raises its own admin
  // alert and a Sentry event, and the link is returned here regardless, so it
  // can be sent by hand if the email never lands.
  return NextResponse.json({
    ok: true,
    sentTo: biz.email,
    payUrl,
    feeAed,
    expiresAt,
  })
}
