import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'
import { str, stringMap, uuid } from '@/lib/validate'

// Captures a join application as soon as someone gets past the eligibility
// step (or fills in step 2), even if they never reach payment. This is the
// sole source for the "started join, never paid" admin list - replacing the
// old Stripe checkout.session.expired based detection, which only caught
// people who reached the final Pay button.
export async function POST(req: NextRequest) {
  try {
    if (await isRateLimitedShared(`join-lead:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 30 })) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    // The lead id is made by the browser, so it must at least be a real UUID,
    // and the answers are plain short strings.
    const leadId = uuid(body?.leadId)
    const fullName = str(body?.fullName, 200)
    if (!leadId || !fullName) {
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

    const answers = stringMap(body, 60)
    const { email: rawEmail, gender, uaeMobile, emirate, heritageConfirm, falseInfoConfirm, termsConfirm } = answers
    const email = rawEmail && isValidEmail(rawEmail) ? normaliseEmail(rawEmail) : null
    // Whatever else the form sent is kept whole in `details`, minus the fields
    // that already have their own columns.
    const rest = { ...answers }
    for (const k of ['leadId', 'fullName', 'email', 'gender', 'uaeMobile', 'emirate', 'heritageConfirm', 'falseInfoConfirm', 'termsConfirm']) delete rest[k]
    const details = { uaeMobile, emirate, ...rest }

    const { error } = await supabaseAdmin
      .from('members')
      .upsert({
        id: leadId,
        full_name: fullName,
        email,
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
      console.error('join lead: could not save', error.message)
      return NextResponse.json({ error: 'Could not save your progress.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('join lead failed:', e)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
