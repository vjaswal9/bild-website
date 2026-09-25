import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { LISTING_MEMBER_FEE_AED, LISTING_NON_MEMBER_FEE_AED } from '@/lib/featured-copy'

// Public endpoint: the token-gated /directory/pay/[token] page posts here to
// start the annual listing-fee checkout. Price is always read from the
// business's own is_bild_member value server-side, never trusted from the
// client, so it can't be tampered with.
export async function POST(req: NextRequest) {
  if (isRateLimited(`listing-checkout:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const { token } = await req.json().catch(() => ({}))
  if (!token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, email, is_bild_member, listing_payment_token_expires_at, slug')
    .eq('listing_payment_token', token)
    .maybeSingle()

  if (!biz) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 })
  if (biz.listing_payment_token_expires_at && new Date(biz.listing_payment_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired. Please contact us for a new one.' }, { status: 410 })
  }

  const feeAed = biz.is_bild_member ? LISTING_MEMBER_FEE_AED : LISTING_NON_MEMBER_FEE_AED
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'aed',
        product_data: { name: 'BILD Business Directory Listing (Annual)' },
        unit_amount: feeAed * 100,
      },
      quantity: 1,
    }],
    customer_email: biz.email,
    client_reference_id: biz.id,
    metadata: { type: 'business_listing', business_id: biz.id },
    success_url: `${origin}/directory/${biz.slug}?activated=1`,
    cancel_url: `${origin}/directory/pay/${token}`,
  })

  return NextResponse.json({ url: session.url })
}
