import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { cardFeeFils } from '@/lib/fees'
import { siteOrigin } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

// Public endpoint: the token-gated /events/upgrade/[token] page posts here to
// start the checkout for a ticket upgrade's price difference. The amount is
// always read from the registration's own upgrade_due_aed server-side, never
// trusted from the client, so it can't be tampered with.
export async function POST(req: NextRequest) {
  if (await isRateLimitedShared(`upgrade-checkout:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const { token } = await req.json().catch(() => ({}))
  if (!token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })

  const { data: reg } = await supabaseAdmin
    .from('event_registrations')
    .select('id, email, ticket_name, upgrade_due_aed, upgrade_payment_token_expires_at, event_id')
    .eq('upgrade_payment_token', token)
    .maybeSingle()

  if (!reg) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 })
  if (reg.upgrade_due_aed == null) {
    return NextResponse.json({ error: 'Nothing is currently owed on this booking.' }, { status: 400 })
  }
  if (reg.upgrade_payment_token_expires_at && new Date(reg.upgrade_payment_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired. Please contact us for a new one.' }, { status: 410 })
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('title, slug')
    .eq('id', reg.event_id)
    .maybeSingle()

  const dueAed = Number(reg.upgrade_due_aed)
  const origin = siteOrigin(req)

  const lineItems = [{
    price_data: {
      currency: 'aed',
      product_data: { name: `${event?.title || 'Event'} - ticket upgrade${reg.ticket_name ? ` (${reg.ticket_name})` : ''}` },
      unit_amount: Math.round(dueAed * 100),
    },
    quantity: 1,
  }]

  const feeFils = cardFeeFils(dueAed)
  if (feeFils > 0) {
    lineItems.push({
      price_data: {
        currency: 'aed',
        product_data: { name: 'Card processing fee' },
        unit_amount: feeFils,
      },
      quantity: 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    customer_email: reg.email,
    client_reference_id: `event_upgrade:${reg.id}`,
    metadata: { type: 'event_upgrade', registration_id: reg.id },
    success_url: `${origin}/events/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/events/upgrade/${token}`,
  })

  return NextResponse.json({ url: session.url })
}
