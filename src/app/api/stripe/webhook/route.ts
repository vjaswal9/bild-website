import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Stripe needs the raw body to verify the signature.
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') || ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET || ''

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'bad signature'
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      id: string
      client_reference_id?: string | null
      customer_email?: string | null
      amount_total?: number | null
    }
    const memberId = session.client_reference_id

    const update = {
      status: 'paid',
      paid_at: new Date().toISOString(),
      amount: session.amount_total ?? 5000,
      stripe_session_id: session.id,
    }

    if (memberId) {
      await supabaseAdmin.from('members').update(update).eq('id', memberId)
    } else if (session.customer_email) {
      // Fallback: match by email (used if a plain Payment Link is used instead of Checkout)
      await supabaseAdmin.from('members').update(update).eq('email', session.customer_email).eq('status', 'pending')
    }
  }

  return NextResponse.json({ received: true })
}
