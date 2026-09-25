import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function authed(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

// Add or update a ticket type.
export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const b = await req.json().catch(() => null)
  if (!b || !b.name) return NextResponse.json({ error: 'Ticket name is required.' }, { status: 400 })

  const price = Math.max(0, Math.round(Number(b.price_aed) || 0))
  const costPrice = b.cost_price_aed === '' || b.cost_price_aed == null ? null : Math.max(0, Math.round(Number(b.cost_price_aed) || 0))
  const fields = {
    // Trailing punctuation is stripped as well as whitespace. Names were being
    // typed as "Adult Ticket:" because they read as a label in the admin form,
    // and that colon then showed up on the door list, in every confirmation
    // email and in the ticket offers published to search engines.
    name: String(b.name).replace(/[\s:.\-\u2013\u2014]+$/, '').trim(),
    description: b.description ?? '',
    price_aed: price,
    cost_price_aed: costPrice,
    // When true the booking form asks for each attendee's age on this ticket,
    // and the checkout route refuses the booking without one.
    is_child: b.is_child === true,
    sort_order: Number(b.sort_order) || 0,
    active: b.active === false ? false : true,
  }

  if (b.id) {
    const { error } = await supabaseAdmin.from('event_tickets').update(fields).eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: b.id })
  }

  if (!b.event_id) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('event_tickets')
    .insert([{ ...fields, event_id: b.event_id }])
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await supabaseAdmin.from('event_tickets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
