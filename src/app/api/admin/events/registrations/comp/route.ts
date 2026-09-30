import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { isPastEvent, GuestEntry } from '@/lib/events'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'
import { generateSeatingCode } from '@/lib/seating-code'
import { sendEventConfirmation, sendTicketSaleAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'

const MAX_CHILD_AGE = 17
function normalizeAge(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (!Number.isInteger(n) || n < 0 || n > MAX_CHILD_AGE) return null
  return n
}

// Admin-only: gives away a ticket for free without the buyer going through
// Stripe. Unlike a ticket type simply priced at 0 AED (which anyone can book
// publicly), this stays off the public page - only an admin can issue one,
// to a specific named person. The resulting booking is otherwise a normal
// paid, capacity-counted, seatable registration; it is only flagged
// `is_complimentary` so reporting excludes it from both revenue and cost -
// these are typically the venue's own gift, not something BILD pays for.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { eventId, ticketId, firstName, lastName, email, phone, age: buyerAgeRaw, guests: rawGuests } = await req.json().catch(() => ({}))
  if (!eventId || !ticketId || !firstName || !email) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please check the email address, it does not look valid.' }, { status: 400 })
  }
  const buyerEmail = normaliseEmail(email)

  const incomingGuests: { name?: string; age?: unknown }[] = Array.isArray(rawGuests) ? rawGuests : []
  if (incomingGuests.some(g => !g?.name || !String(g.name).trim())) {
    return NextResponse.json({ error: 'Please provide a name for each extra guest.' }, { status: 400 })
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, slug, title, event_date, end_date, venue, google_maps_url, capacity_limit, seating_enabled, seats_per_table')
    .eq('id', eventId)
    .maybeSingle()
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 })
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (isPastEvent(event)) {
    return NextResponse.json({ error: 'This event has already happened.' }, { status: 400 })
  }

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('event_tickets')
    .select('id, name, is_child')
    .eq('id', ticketId)
    .eq('event_id', eventId)
    .maybeSingle()
  if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 500 })
  if (!ticket) return NextResponse.json({ error: 'Ticket package not found.' }, { status: 400 })

  const buyerAge = ticket.is_child ? normalizeAge(buyerAgeRaw) : null
  if (ticket.is_child && buyerAge == null) {
    return NextResponse.json({ error: `Please give an age between 0 and ${MAX_CHILD_AGE} for the guest of honour.` }, { status: 400 })
  }
  const guestEntries: GuestEntry[] = []
  for (const g of incomingGuests) {
    const guestAge = ticket.is_child ? normalizeAge(g.age) : null
    if (ticket.is_child && guestAge == null) {
      return NextResponse.json({ error: `Please give an age between 0 and ${MAX_CHILD_AGE} for every guest.` }, { status: 400 })
    }
    guestEntries.push({
      name: String(g.name).trim(),
      ticket_name: ticket.name,
      price_aed: 0,
      ...(guestAge != null ? { age: guestAge } : {}),
    })
  }

  const qty = 1 + guestEntries.length

  if (event.capacity_limit != null) {
    const { data: soldRows, error: soldError } = await supabaseAdmin
      .from('event_registrations')
      .select('quantity')
      .eq('event_id', eventId)
      .eq('status', 'paid')
    if (soldError) return NextResponse.json({ error: soldError.message }, { status: 500 })
    const soldQty = (soldRows || []).reduce((s, r) => s + (Number(r.quantity) || 1), 0)
    const remaining = event.capacity_limit - soldQty
    if (qty > remaining) {
      return NextResponse.json({
        error: remaining <= 0
          ? 'This event is at capacity - free up a seat before issuing a complimentary ticket.'
          : `Only ${remaining} seat${remaining === 1 ? '' : 's'} left - reduce the number of guests.`,
      }, { status: 400 })
    }
  }

  const seatingCode = event.seating_enabled ? generateSeatingCode() : null
  const now = new Date().toISOString()

  const { data: reg, error: regErr } = await supabaseAdmin
    .from('event_registrations')
    .insert([{
      event_id: eventId,
      ticket_id: ticket.id,
      ticket_name: ticket.name,
      first_name: firstName,
      last_name: lastName || '',
      email: buyerEmail,
      phone: phone || null,
      quantity: qty,
      guest_names: guestEntries,
      amount_aed: 0,
      status: 'paid',
      paid_at: now,
      attendee_age: buyerAge,
      seating_code: seatingCode,
      is_complimentary: true,
      admin_note: `${new Date().toLocaleDateString('en-GB')}: complimentary ticket issued by admin`,
    }])
    .select('id')
    .single()
  if (regErr || !reg) {
    return NextResponse.json({ error: regErr?.message || 'Could not create the booking.' }, { status: 500 })
  }

  await sendEventConfirmation({
    to: buyerEmail,
    firstName,
    lastName,
    eventTitle: event.title,
    ticketName: ticket.name,
    eventDate: event.event_date,
    amountAed: 0,
    quantity: qty,
    guests: guestEntries,
    attendeeAge: buyerAge,
    venue: event.venue,
    googleMapsUrl: event.google_maps_url,
    eventSlug: event.slug,
    eventEndDate: event.end_date,
    seatingEnabled: event.seating_enabled,
    seatingCode,
    seatingPosition: null,
  })
  await sendTicketSaleAlert({
    eventTitle: event.title,
    buyerName: `${firstName} ${lastName || ''}`.trim(),
    buyerEmail,
    ticketName: ticket.name,
    quantity: qty,
    amountAed: 0,
    guests: guestEntries,
  })

  return NextResponse.json({ ok: true, id: reg.id })
}
