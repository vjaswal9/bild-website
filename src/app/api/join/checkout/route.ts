import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { randomUUID } from 'crypto'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`join:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 8 })) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
    }

    const { leadId, ...d } = await req.json()

    if (!d.fullName || !d.email || !d.gender) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    if (!isValidEmail(d.email)) {
      return NextResponse.json({ error: 'Please check your email address, it does not look valid.' }, { status: 400 })
    }
    d.email = normaliseEmail(d.email)

    // Reuse the lead row created during step 1/2 of the form, if present.
    // Otherwise fall back to the existing pending signup for this email
    // (e.g. a retry in a new tab without the original leadId) instead of
    // creating a duplicate row (and a duplicate Stripe session).
    const { data: existingPending } = leadId
      ? await supabaseAdmin
          .from('members')
          .select('id, invite_token, invite_expires_at')
          .eq('id', leadId)
          .eq('status', 'pending')
          .maybeSingle()
      : { data: null }

    const { data: existingByEmail } = !existingPending
      ? await supabaseAdmin
          .from('members')
          .select('id, invite_token, invite_expires_at')
          .eq('email', d.email)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null }

    const existing = existingPending || existingByEmail

    const inviteToken = existing?.invite_token || randomUUID().replace(/-/g, '')
    const inviteExpires = existing?.invite_expires_at || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // Everything except the core columns is kept in `details` jsonb.
    const { fullName, email, gender, uaeMobile, emirate, ...rest } = d
    const details = { uaeMobile, emirate, ...rest }

    const row = {
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
    }

    let member: { id: string } | null = null
    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from('members')
        .update(row)
        .eq('id', existing.id)
        .select('id')
        .single()
      if (error || !updated) {
        return NextResponse.json({ error: error?.message || 'Could not update member record.' }, { status: 500 })
      }
      member = updated
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from('members')
        .insert([row])
        .select('id')
        .single()
      if (error || !inserted) {
        return NextResponse.json({ error: error?.message || 'Could not create member record.' }, { status: 500 })
      }
      member = inserted
    }

    const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      // Expire unpaid Stripe sessions after 1 hour of inactivity.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      line_items: [
        process.env.STRIPE_PRICE_ID
          ? { price: process.env.STRIPE_PRICE_ID, quantity: 1 }
          : {
              price_data: {
                currency: 'aed',
                product_data: { name: 'BILD Membership' },
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
    // Logged in full, but not returned. This message went straight to the
    // browser, which meant raw Postgres and Stripe errors (table names,
    // constraint names, internal ids) were being shown to whoever triggered
    // them, and were useless to that person anyway.
    console.error('Checkout failed:', e)
    Sentry.captureException(e, { tags: { flow: 'checkout' } })
    return NextResponse.json(
      { error: 'We could not start your membership just now. Please try again in a moment.' },
      { status: 500 },
    )
  }
}
