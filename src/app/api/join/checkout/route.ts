import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const d = await req.json()

    if (!d.fullName || !d.email || !d.gender) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const inviteToken = randomUUID().replace(/-/g, '')
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // Everything except the core columns is kept in `details` jsonb.
    const { fullName, email, gender, uaeMobile, emirate, ...rest } = d
    const details = { uaeMobile, emirate, ...rest }

    const { data: member, error } = await supabaseAdmin
      .from('members')
      .insert([{
        full_name: fullName,
        email,
        phone: uaeMobile || null,
        gender,
        location: emirate || null,
        eligibility: { heritageConfirm: d.heritageConfirm, falseInfoConfirm: d.falseInfoConfirm, termsConfirm: d.termsConfirm },
        details,
        status: 'pending',
        amount: 5000,
        currency: 'aed',
        invite_token: inviteToken,
        invite_expires_at: inviteExpires,
      }])
      .select('id')
      .single()

    if (error || !member) {
      return NextResponse.json({ error: error?.message || 'Could not create member record.' }, { status: 500 })
    }

    const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        process.env.STRIPE_PRICE_ID
          ? { price: process.env.STRIPE_PRICE_ID, quantity: 1 }
          : {
              price_data: {
                currency: 'aed',
                product_data: { name: 'BILD Lifetime Membership' },
                unit_amount: 5000,
              },
              quantity: 1,
            },
      ],
      customer_email: email,
      client_reference_id: member.id,
      metadata: { member_id: member.id, full_name: fullName, gender },
      success_url: `${origin}/join/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/join`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
