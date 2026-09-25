import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, MONEY_COOKIE, verifyAdminToken, verifyMoneyToken } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// The Money screens need the standing admin session AND the short-lived
// Money unlock, so these endpoints cannot be used from a signed-in tab that
// has not passed the second password check.
async function moneyGuard(req: NextRequest): Promise<boolean> {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) return false
  return verifyMoneyToken(req.cookies.get(MONEY_COOKIE)?.value)
}


// Admin-only CRUD for operating costs: everything BILD spends that Stripe
// fees and per-ticket cost prices do not already capture, such as the trade
// licence, venue deposits, photography or software. A cost can optionally be
// attributed to an event so per-event profit reflects what the event really
// cost to put on.

async function guard(req: NextRequest) {
  return moneyGuard(req)
}

export async function POST(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const amount = Number(b.amountAed)
  const description = String(b.description || '').trim()
  const incurredOn = String(b.incurredOn || '').trim()

  if (!description) return NextResponse.json({ error: 'Please describe the cost.' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Please enter an amount greater than zero.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incurredOn)) {
    return NextResponse.json({ error: 'Please give a valid date.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('operating_costs')
    .insert([{
      incurred_on: incurredOn,
      category: String(b.category || 'Other'),
      description,
      amount_aed: Math.round(amount * 100) / 100,
      event_id: b.eventId ? String(b.eventId) : null,
      notes: b.notes ? String(b.notes) : null,
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

  const { error } = await supabaseAdmin.from('operating_costs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
