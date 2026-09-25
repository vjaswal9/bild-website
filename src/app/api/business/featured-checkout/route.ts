import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { FEATURED_MEMBER_FEE_AED, FEATURED_NON_MEMBER_FEE_AED } from '@/lib/featured-copy'

// Public, self-serve: any approved business can pay to become Featured any
// time via their standing token, no admin action required.
export async function POST(req: NextRequest) {
  if (isRateLimited(`featured-checkout:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const { token } = await req.json().catch(() => ({}))
  if (!token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, email, is_bild_member, status, slug')
    .eq('featured_payment_token', token)
    .maybeSingle()

  if (!biz || biz.status !== 'approved') return NextResponse.json({ error: 'Invalid link.' }, { status: 404 })

  const feeAed = biz.is_bild_member ? FEATURED_MEMBER_FEE_AED : FEATURED_NON_MEMBER_FEE_AED
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'aed',
        product_data: { name: 'BILD Business Directory - Featured Placement (Quarterly)' },
        unit_amount: feeAed * 100,
      },
      quantity: 1,
    }],
    customer_email: biz.email,
    client_reference_id: biz.id,
    metadata: { type: 'business_featured', business_id: biz.id },
    success_url: `${origin}/directory/${biz.slug}?featured=1`,
    cancel_url: `${origin}/directory/feature/${token}`,
  })

  return NextResponse.json({ url: session.url })
}
