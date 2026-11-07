import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { oneOf, str, uuid } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// Admin-only: what an event's Cash flow view reads and the few things it can
// change. It never touches the figures profit is worked out from. Costs and
// hand-typed revenue lines only gain a paid / received flag; payments towards
// the hotel or venue bill live in their own table (event_venue_payments) so
// they can never be counted as an extra cost.

async function guard(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const num = (v: unknown) => Number(v) || 0

export async function GET(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const eventId = uuid(req.nextUrl.searchParams.get('eventId'))
  if (!eventId) return NextResponse.json({ error: 'Missing event.' }, { status: 400 })

  const [cardRes, revRes, costRes, venueRes] = await Promise.all([
    // Every real card payment on the event: tickets and anything sold at the
    // event by Payment Link. What reaches BILD is the charge less Stripe's fee
    // and any refund.
    supabaseAdmin
      .from('payments')
      .select('gross_aed, stripe_fee_aed, refunded_aed')
      .eq('event_id', eventId)
      .in('source', ['webhook', 'backfill']),
    supabaseAdmin
      .from('payments')
      .select('id, paid_at, kind, description, revenue_aed, settled')
      .eq('event_id', eventId)
      .eq('source', 'manual')
      .order('paid_at', { ascending: true }),
    supabaseAdmin
      .from('operating_costs')
      .select('id, incurred_on, category, description, amount_aed, settled')
      .eq('event_id', eventId)
      .order('incurred_on', { ascending: true }),
    supabaseAdmin
      .from('event_venue_payments')
      .select('id, due_on, description, amount_aed, settled')
      .eq('event_id', eventId)
      .order('due_on', { ascending: true }),
  ])

  for (const r of [cardRes, revRes, costRes, venueRes]) {
    if (r.error) return NextResponse.json({ error: 'Could not load the cash flow. Has the cash flow SQL been run?' }, { status: 500 })
  }

  const card = (cardRes.data || []).reduce(
    (a, p) => ({
      gross: a.gross + num(p.gross_aed),
      stripeFees: a.stripeFees + num(p.stripe_fee_aed),
      refunds: a.refunds + num(p.refunded_aed),
    }),
    { gross: 0, stripeFees: 0, refunds: 0 },
  )
  const round2 = (n: number) => Math.round(n * 100) / 100

  return NextResponse.json({
    card: {
      gross: round2(card.gross),
      stripeFees: round2(card.stripeFees),
      refunds: round2(card.refunds),
      net: round2(card.gross - card.stripeFees - card.refunds),
      payments: (cardRes.data || []).length,
    },
    revenue: (revRes.data || []).map(r => ({
      id: r.id, date: String(r.paid_at).slice(0, 10), kind: r.kind, description: r.description || '',
      amountAed: num(r.revenue_aed), settled: r.settled !== false,
    })),
    costs: (costRes.data || []).map(c => ({
      id: c.id, date: String(c.incurred_on).slice(0, 10), category: c.category || 'Other', description: c.description || '',
      amountAed: num(c.amount_aed), settled: c.settled !== false,
    })),
    venue: (venueRes.data || []).map(v => ({
      id: v.id, date: String(v.due_on).slice(0, 10), description: v.description || '',
      amountAed: num(v.amount_aed), settled: v.settled === true,
    })),
  })
}

// Marks a cost, a hand-typed revenue line or a venue payment as paid / received
// (settled) or still to come. The only change this makes to a cost or revenue
// line, and it is limited to the event the line belongs to.
export async function PATCH(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const type = oneOf<'revenue' | 'cost' | 'venue' | ''>(b.type, ['revenue', 'cost', 'venue'], '')
  const id = uuid(b.id)
  const eventId = uuid(b.eventId)
  if (!type || !id || !eventId || typeof b.settled !== 'boolean') {
    return NextResponse.json({ error: 'Missing or unknown line.' }, { status: 400 })
  }

  const q = type === 'revenue'
    ? supabaseAdmin.from('payments').update({ settled: b.settled }).eq('id', id).eq('event_id', eventId).eq('source', 'manual')
    : type === 'cost'
      ? supabaseAdmin.from('operating_costs').update({ settled: b.settled }).eq('id', id).eq('event_id', eventId)
      : supabaseAdmin.from('event_venue_payments').update({ settled: b.settled }).eq('id', id).eq('event_id', eventId)
  const { data, error } = await q.select('id')
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'That line no longer exists. Refresh and try again.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

function readVenue(b: Record<string, unknown>) {
  const date = str(b.date, 10)
  const description = str(b.description, 120)
  const amount = Math.round(num(b.amountAed) * 100) / 100
  if (!DATE.test(date)) return { error: 'Please give a valid date.' }
  if (!description) return { error: 'Please say what the payment is for.' }
  if (!(amount > 0) || amount > 100000000) return { error: 'Please enter an amount greater than zero.' }
  return { date, description, amount, settled: b.settled === true }
}

// Adds a payment (made or planned) towards the hotel / venue bill.
export async function POST(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const eventId = uuid(b.eventId)
  if (!eventId) return NextResponse.json({ error: 'Missing event.' }, { status: 400 })
  const v = readVenue(b)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('event_venue_payments')
    .insert([{ event_id: eventId, due_on: v.date, description: v.description, amount_aed: v.amount, settled: v.settled }])
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PUT(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const id = uuid(b.id)
  const eventId = uuid(b.eventId)
  if (!id || !eventId) return NextResponse.json({ error: 'Missing line or event.' }, { status: 400 })
  const v = readVenue(b)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('event_venue_payments')
    .update({ due_on: v.date, description: v.description, amount_aed: v.amount, settled: v.settled })
    .eq('id', id).eq('event_id', eventId)
    .select('id')
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'That payment no longer exists.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const id = uuid(req.nextUrl.searchParams.get('id'))
  const eventId = uuid(req.nextUrl.searchParams.get('eventId'))
  if (!id || !eventId) return NextResponse.json({ error: 'Missing line or event.' }, { status: 400 })
  const { error } = await supabaseAdmin.from('event_venue_payments').delete().eq('id', id).eq('event_id', eventId)
  if (error) return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
