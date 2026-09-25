import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, MONEY_COOKIE, verifyAdminToken, verifyMoneyToken } from '@/lib/admin-auth'
import { PaymentKind } from '@/lib/money'

export const dynamic = 'force-dynamic'

// The Money screens need the standing admin session AND the short-lived
// Money unlock, so these endpoints cannot be used from a signed-in tab that
// has not passed the second password check.
async function moneyGuard(req: NextRequest): Promise<boolean> {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) return false
  return verifyMoneyToken(req.cookies.get(MONEY_COOKIE)?.value)
}


// Admin-only entry of income that never went through Stripe: cash at the
// door, a bank transfer, a sponsorship, or a whole year that predates the
// website. These rows sit in the same ledger as Stripe payments so the
// dashboard totals are complete, but are marked source = 'manual' so they
// can always be told apart and the Stripe import never touches them.

const KINDS: PaymentKind[] = ['membership', 'event_ticket', 'listing', 'featured', 'sponsorship', 'other']

async function guard(req: NextRequest) {
  return moneyGuard(req)
}

export async function POST(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const amount = Number(b.amountAed)
  const description = String(b.description || '').trim()
  const paidOn = String(b.paidOn || '').trim()
  const kind = String(b.kind || 'other') as PaymentKind

  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Please choose a revenue stream.' }, { status: 400 })
  }
  if (!description) return NextResponse.json({ error: 'Please describe the income.' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Please enter an amount greater than zero.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
    return NextResponse.json({ error: 'Please give a valid date.' }, { status: 400 })
  }

  const fee = Number(b.stripeFeeAed)
  const rounded = Math.round(amount * 100) / 100

  const { data, error } = await supabaseAdmin
    .from('payments')
    // Recorded at midday UTC so the date cannot slip either side of a
    // timezone boundary and land in the wrong month or year.
    .insert([{
      paid_at: `${paidOn}T12:00:00.000Z`,
      kind,
      description,
      event_id: b.eventId ? String(b.eventId) : null,
      gross_aed: rounded,
      revenue_aed: rounded,
      fee_passed_on_aed: 0,
      // Usually zero: cash and bank transfers cost no card fee. Kept
      // editable for the odd payment taken on another card terminal.
      stripe_fee_aed: Number.isFinite(fee) && fee > 0 ? Math.round(fee * 100) / 100 : 0,
      refunded_aed: 0,
      currency: 'aed',
      stripe_session_id: null,
      source: 'manual',
    }])
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  // Deliberately restricted to manually entered rows: a real Stripe payment
  // is a record of money that moved and must not be deletable from here.
  const { error } = await supabaseAdmin
    .from('payments')
    .delete()
    .eq('id', id)
    .eq('source', 'manual')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
