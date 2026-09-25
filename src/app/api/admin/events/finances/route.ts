import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Additional revenue and costs recorded against a single event: sponsorship
// money in, DJ and lighting out. Deliberately stored in the same two tables
// the Money dashboard already reads (`payments` for revenue, marked
// source = 'manual', and `operating_costs` for costs), rather than an
// event-only table that would then need reconciling. That is what makes
// these lines bubble up into the year totals and per-event profit with no
// extra wiring.

async function guard(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

const REVENUE_KINDS = new Set(['sponsorship', 'other'])

export async function GET(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  const [revRes, costRes, evRes] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('id, paid_at, kind, description, revenue_aed')
      .eq('event_id', eventId)
      .eq('source', 'manual')
      .order('paid_at', { ascending: false }),
    supabaseAdmin
      .from('operating_costs')
      .select('id, incurred_on, category, description, amount_aed')
      .eq('event_id', eventId)
      .order('incurred_on', { ascending: false }),
    supabaseAdmin.from('events').select('has_extra_finances').eq('id', eventId).maybeSingle(),
  ])

  if (revRes.error) return NextResponse.json({ error: revRes.error.message }, { status: 500 })
  if (costRes.error) return NextResponse.json({ error: costRes.error.message }, { status: 500 })

  return NextResponse.json({
    // Defaults to true when any line already exists, so an event that was
    // filled in before this flag existed does not appear empty.
    enabled: evRes.data?.has_extra_finances
      ?? ((revRes.data?.length || 0) + (costRes.data?.length || 0) > 0),
    revenue: (revRes.data || []).map(r => ({
      id: r.id,
      date: String(r.paid_at).slice(0, 10),
      kind: r.kind,
      description: r.description || '',
      amountAed: Number(r.revenue_aed) || 0,
    })),
    costs: (costRes.data || []).map(c => ({
      id: c.id,
      date: String(c.incurred_on).slice(0, 10),
      category: c.category || 'Other',
      description: c.description || '',
      amountAed: Number(c.amount_aed) || 0,
    })),
  })
}

// Sets the yes/no answer for an event.
export async function PATCH(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { eventId, enabled } = await req.json().catch(() => ({}))
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('events')
    .update({ has_extra_finances: !!enabled })
    .eq('id', eventId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const eventId = String(b.eventId || '')
  const type = String(b.type || '')
  const amount = Number(b.amountAed)
  const description = String(b.description || '').trim()
  const date = String(b.date || '').trim()

  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  if (type !== 'revenue' && type !== 'cost') {
    return NextResponse.json({ error: 'Unknown line type.' }, { status: 400 })
  }
  if (!description) return NextResponse.json({ error: 'Please describe the line item.' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Please enter an amount greater than zero.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Please give a valid date.' }, { status: 400 })
  }

  const rounded = Math.round(amount * 100) / 100

  if (type === 'revenue') {
    const kind = String(b.kind || 'sponsorship')
    if (!REVENUE_KINDS.has(kind)) {
      return NextResponse.json({ error: 'Unknown revenue type.' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('payments')
      // Midday UTC so the date cannot slip a month or year boundary.
      .insert([{
        paid_at: `${date}T12:00:00.000Z`,
        kind,
        description,
        event_id: eventId,
        gross_aed: rounded,
        revenue_aed: rounded,
        fee_passed_on_aed: 0,
        // Sponsorship and bar takings do not come through a card, so there
        // is no processing fee to account for.
        stripe_fee_aed: 0,
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

  const { data, error } = await supabaseAdmin
    .from('operating_costs')
    .insert([{
      incurred_on: date,
      category: String(b.category || 'Other'),
      description,
      amount_aed: rounded,
      event_id: eventId,
    }])
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  const type = req.nextUrl.searchParams.get('type')
  if (!id || (type !== 'revenue' && type !== 'cost')) {
    return NextResponse.json({ error: 'Missing id or type.' }, { status: 400 })
  }

  // The source filter keeps a real Stripe payment out of reach from here.
  const { error } = type === 'revenue'
    ? await supabaseAdmin.from('payments').delete().eq('id', id).eq('source', 'manual')
    : await supabaseAdmin.from('operating_costs').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
