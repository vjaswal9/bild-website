import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { httpUrl } from '@/lib/validate'
import { planTicketRename, type RenameRegistration, type RenameWaitlistEntry } from '@/lib/ticket-rename'

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
    // Only http(s) is ever stored: a javascript: or data: URL here would
    // become a live link on the public booking page the moment it renders.
    menu_image_url: b.menu_image_url ? httpUrl(b.menu_image_url) ?? null : null,
    food_menu_image_url: b.food_menu_image_url ? httpUrl(b.food_menu_image_url) ?? null : null,
  }

  if (b.id) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('event_tickets')
      .select('id, event_id, name')
      .eq('id', b.id)
      .maybeSingle()
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'That ticket was not found.' }, { status: 404 })

    // A rename also has to reach the bookings and waiting list that carry the
    // old name (see src/lib/ticket-rename.ts). The bookings are changed FIRST
    // and the ticket itself LAST: if anything fails part-way, the ticket still
    // has its old name, so pressing Save again repeats the rename and finishes
    // it. Changing the ticket first would leave a half-renamed event with no
    // way for a second try to know what the old name was.
    let updated = { bookings: 0, guests: 0, waitlist: 0 }
    let ambiguous = 0
    if (existing.name !== fields.name) {
      const { data: siblings, error: siblingsError } = await supabaseAdmin
        .from('event_tickets')
        .select('id, name')
        .eq('event_id', existing.event_id)
      if (siblingsError) return NextResponse.json({ error: siblingsError.message }, { status: 500 })
      const others = (siblings || []).filter(t => String(t.id) !== String(existing.id))
      // Two tickets with one name could not be told apart by anything that
      // looks tickets up by name, so a rename may not create that.
      if (others.some(t => t.name === fields.name)) {
        return NextResponse.json({ error: 'Another ticket on this event already has that name.' }, { status: 400 })
      }

      const { data: regs, error: regsError } = await supabaseAdmin
        .from('event_registrations')
        .select('id, ticket_id, ticket_name, guest_names')
        .eq('event_id', existing.event_id)
      if (regsError) return NextResponse.json({ error: regsError.message }, { status: 500 })

      // Older databases may not have the waiting-list ticket column yet; the
      // rename simply has nothing to carry there.
      const { data: waits, error: waitsError } = await supabaseAdmin
        .from('event_waitlist')
        .select('id, ticket_preferences')
        .eq('event_id', existing.event_id)
      const waitColumnMissing = !!waitsError && (waitsError.code === '42703' || waitsError.code === 'PGRST204' || /ticket_preferences/.test(waitsError.message || ''))
      if (waitsError && !waitColumnMissing) return NextResponse.json({ error: waitsError.message }, { status: 500 })

      const plan = planTicketRename({
        ticketId: String(existing.id),
        oldName: existing.name,
        newName: fields.name,
        oldNameShared: others.some(t => t.name === existing.name),
        registrations: (regs || []) as RenameRegistration[],
        waitlist: (waitColumnMissing ? [] : waits || []) as RenameWaitlistEntry[],
      })

      for (const r of plan.registrations) {
        const { error } = await supabaseAdmin
          .from('event_registrations')
          .update(r.patch)
          .eq('id', r.id)
          .eq('event_id', existing.event_id)
        if (error) return NextResponse.json({ error: `Could not rename on a booking (${error.message}). Nothing is lost: press Save again to finish.` }, { status: 500 })
      }
      for (const w of plan.waitlist) {
        const { error } = await supabaseAdmin
          .from('event_waitlist')
          .update({ ticket_preferences: w.ticket_preferences })
          .eq('id', w.id)
          .eq('event_id', existing.event_id)
        if (error) return NextResponse.json({ error: `Could not rename on a waiting-list entry (${error.message}). Nothing is lost: press Save again to finish.` }, { status: 500 })
      }
      updated = plan.counts
      ambiguous = plan.ambiguous
    }

    // Whether the ticket is on sale is only changed when the caller says so.
    // Defaulting it to true here meant editing the description of a ticket that
    // had been switched off quietly put it back on sale.
    const updateFields = b.active === undefined ? fields : { ...fields, active: b.active !== false }
    const { error } = await supabaseAdmin.from('event_tickets').update(updateFields).eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: b.id, updated, ambiguous })
  }

  if (!b.event_id) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('event_tickets')
    .insert([{ ...fields, active: b.active === false ? false : true, event_id: b.event_id }])
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
