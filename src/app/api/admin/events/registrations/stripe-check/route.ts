import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Read-only comparison of one booking against Stripe.
//
// Built after a refund that BILD had recorded could not be found in the Stripe
// dashboard. It turned out to be there, but proving that meant reading the
// database by hand because the Stripe key is not available outside production.
// This answers the question from inside the admin instead.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { data: reg } = await supabaseAdmin
    .from('event_registrations')
    .select('id, status, amount_aed, refunded_amount_aed, stripe_session_id, first_name, last_name')
    .eq('id', id)
    .maybeSingle()
  if (!reg) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })

  const bild = {
    status: reg.status,
    ticketValueAed: Number(reg.amount_aed) || 0,
    refundedAed: Number(reg.refunded_amount_aed) || 0,
  }

  if (!reg.stripe_session_id) {
    return NextResponse.json({
      bild,
      stripe: null,
      verdict: 'no-payment',
      message: 'This booking has no Stripe payment behind it, so there is nothing to compare. Free tickets are recorded in BILD only.',
    })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(reg.stripe_session_id, {
      expand: ['payment_intent.latest_charge'],
    })
    const pi = session.payment_intent
    if (!pi || typeof pi === 'string') {
      return NextResponse.json({ bild, stripe: null, verdict: 'not-found', message: 'Stripe has no payment recorded against this booking.' })
    }
    const charge = pi.latest_charge
    if (!charge || typeof charge === 'string') {
      return NextResponse.json({ bild, stripe: null, verdict: 'not-found', message: 'Stripe has no completed charge against this booking.' })
    }

    const refundList = await stripe.refunds.list({ charge: charge.id, limit: 20 })
    const refunds = refundList.data.map(r => ({
      id: r.id,
      amountAed: (r.amount ?? 0) / 100,
      status: r.status,
      createdAt: new Date(r.created * 1000).toISOString(),
      reason: r.reason || null,
    }))

    const stripeSide = {
      chargeId: charge.id,
      paymentIntentId: pi.id,
      // What the buyer was charged, which includes the card fee passed on at
      // checkout, so it is normally a little above the ticket value.
      chargedAed: (charge.amount ?? 0) / 100,
      refundedAed: (charge.amount_refunded ?? 0) / 100,
      paidAt: charge.created ? new Date(charge.created * 1000).toISOString() : null,
      refunds,
      dashboardUrl: `https://dashboard.stripe.com/payments/${pi.id}`,
    }

    // Agreement is judged on the refunded amount, to the penny. The charged
    // amount is deliberately not compared with the ticket value, because they
    // differ by the card fee by design.
    const agrees = Math.abs(stripeSide.refundedAed - bild.refundedAed) < 0.01
    return NextResponse.json({
      bild,
      stripe: stripeSide,
      verdict: agrees ? 'match' : 'mismatch',
      message: agrees
        ? 'BILD and Stripe agree on what has been refunded.'
        : `BILD records ${bild.refundedAed} AED refunded but Stripe shows ${stripeSide.refundedAed} AED.`,
    })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Could not read this payment from Stripe.',
    }, { status: 502 })
  }
}
