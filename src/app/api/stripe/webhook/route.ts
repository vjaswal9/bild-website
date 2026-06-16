import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendWelcomeEmail } from '@/lib/email'

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

    const query = memberId
      ? supabaseAdmin.from('members').update(update).eq('id', memberId)
      : session.customer_email
        ? supabaseAdmin.from('members').update(update).eq('email', session.customer_email).eq('status', 'pending')
        : null

    if (query) {
      const { data: rows } = await query.select('email, full_name, invite_token')
      const member = rows?.[0]
      if (member?.invite_token) {
        const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
        const base = process.env.NEXT_PUBLIC_SITE_URL || origin
        await sendWelcomeEmail({
          to: member.email,
          name: member.full_name,
          inviteUrl: `${base}/j/${member.invite_token}`,
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
