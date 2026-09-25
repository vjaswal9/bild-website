import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'

// Captures a join application as soon as someone gets past the eligibility
// step (or fills in step 2), even if they never reach payment. This is the
// sole source for the "started join, never paid" admin list - replacing the
// old Stripe checkout.session.expired based detection, which only caught
// people who reached the final Pay button.
export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`join-lead:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 30 })) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 })
    }

    const { leadId, ...d } = await req.json()
    if (!leadId || !d.fullName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('members')
      .select('id, status')
      .eq('id', leadId)
      .maybeSingle()

    // Once paid, a lead capture call (e.g. a late-firing beacon) must never
    // downgrade the record back to pending.
    if (existing?.status === 'paid') {
      return NextResponse.json({ ok: true })
    }

    const { fullName, email, gender, uaeMobile, emirate, heritageConfirm, falseInfoConfirm, termsConfirm, ...rest } = d
    const details = { uaeMobile, emirate, ...rest }

    const { error } = await supabaseAdmin
      .from('members')
      .upsert({
        id: leadId,
        full_name: fullName,
        email: email || null,
        phone: uaeMobile || null,
        gender: gender || null,
        location: emirate || null,
        eligibility: { heritageConfirm, falseInfoConfirm, termsConfirm },
        details,
        status: 'pending',
        amount: 5000,
        currency: 'aed',
      }, { onConflict: 'id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
