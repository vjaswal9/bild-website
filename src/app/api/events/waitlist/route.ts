import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'
import { sendWaitlistJoinedEmail, sendWaitlistJoinedAdminAlert } from '@/lib/email'
import { reportError } from '@/lib/report-error'
import { cleanTicketChoices, describeTicketChoices, type WaitTicketChoice } from '@/lib/waitlist-tickets'

export const dynamic = 'force-dynamic'

// Public: join the waitlist for a sold-out event.
export async function POST(req: NextRequest) {
  if (await isRateLimitedShared(`waitlist:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const eventId = String(b.eventId || '')
  const firstName = String(b.firstName || '').trim()
  const lastName = String(b.lastName || '').trim()
  const email = String(b.email || '')
  const phone = String(b.phone || '').trim()
  const wanted = Number(b.ticketsWanted)

  if (!eventId || !firstName) {
    return NextResponse.json({ error: 'Please give your name.' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please check your email address, it does not look valid.' }, { status: 400 })
  }
  let ticketsWanted = Number.isFinite(wanted) ? Math.min(Math.max(Math.round(wanted), 1), 10) : 1

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, title, slug, status, capacity_limit, waitlist_open, event_date, end_date')
    .eq('id', eventId)
    .maybeSingle()

  if (!event || event.status !== 'published') {
    return NextResponse.json({ error: 'Event not available.' }, { status: 404 })
  }
  if (event.capacity_limit == null) {
    // Without a cap there is nothing to wait for: tickets are still on sale.
    return NextResponse.json({ error: 'Tickets are still available for this event.' }, { status: 400 })
  }
  if (event.waitlist_open === false) {
    return NextResponse.json({ error: 'The waitlist for this event is closed.' }, { status: 400 })
  }

  // Which ticket types they want. The booking page sends a mix of types
  // ([{ ticketId, quantity }]); an older page that is still open in somebody's
  // browser sends only a number, and that still works exactly as before.
  let choices: WaitTicketChoice[] | null = null
  if (Array.isArray(b.ticketChoices) && b.ticketChoices.length > 0) {
    const { data: ticketRows } = await supabaseAdmin
      .from('event_tickets')
      .select('id, name, active')
      .eq('event_id', eventId)
    const cleaned = cleanTicketChoices(b.ticketChoices, (ticketRows || []) as { id: string; name: string; active: boolean }[])
    if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 })
    choices = cleaned.choices
    // The total is always worked out here, never taken from the browser.
    ticketsWanted = cleaned.total
  }

  const normalised = normaliseEmail(email)

  // Look first, then insert or update.
  //
  // Not an upsert: the unique index is on (event_id, lower(email)), which is
  // an expression index, and `onConflict` can only name real columns. Asking
  // it to conflict on (event_id, email) matches no constraint, so the write
  // fails, and the failure is easy to miss because the fallback update then
  // finds nothing to update and also reports success.
  const { data: existing } = await supabaseAdmin
    .from('event_waitlist')
    .select('id')
    .eq('event_id', eventId)
    .ilike('email', normalised)
    .maybeSingle()

  const fields = {
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    tickets_wanted: ticketsWanted,
    note: b.note ? String(b.note).trim().slice(0, 300) : null,
    status: 'waiting',
  }

  // An existing entry keeps its original created_at, so signing up twice
  // cannot move anybody up the queue.
  const write = (row: Record<string, unknown>) => existing
    ? supabaseAdmin.from('event_waitlist').update(row).eq('id', existing.id)
    : supabaseAdmin.from('event_waitlist').insert([{ ...row, event_id: eventId, email: normalised }])

  let { error } = await write({ ...fields, ticket_preferences: choices })
  // Until supabase/event-waitlist-ticket-types.sql has been run the column does
  // not exist. Do not lose the request: keep the count and put the mix of types
  // in the note, where an admin can still read it.
  if (error && (error.code === '42703' || error.code === 'PGRST204' || /ticket_preferences/.test(error.message || ''))) {
    const note = [fields.note, choices ? `Wants: ${describeTicketChoices(choices)}` : null].filter(Boolean).join(' | ').slice(0, 300) || null
    ;({ error } = await write({ ...fields, note }))
  }

  if (error) {
    reportError('Waitlist write failed:', error)
    return NextResponse.json({ error: 'Could not add you to the waitlist. Please try again.' }, { status: 500 })
  }

  // People and tickets are different numbers - the alert leads with tickets,
  // because that is what has to be weighed against the seats that come free.
  const { data: waitingRows } = await supabaseAdmin
    .from('event_waitlist')
    .select('tickets_wanted')
    .eq('event_id', eventId)
    .eq('status', 'waiting')
  const peopleWaiting = waitingRows?.length ?? 0
  const ticketsWaiting = (waitingRows || []).reduce((s, r) => s + (Number(r.tickets_wanted) || 1), 0)

  await sendWaitlistJoinedEmail({
    to: normalised,
    firstName,
    eventTitle: event.title,
    ticketsWanted,
    ticketChoices: choices || undefined,
  })
  await sendWaitlistJoinedAdminAlert({
    eventTitle: event.title,
    name: `${firstName} ${lastName}`.trim(),
    email: normalised,
    phone: phone || undefined,
    ticketsWanted,
    ticketChoices: choices || undefined,
    totalWaiting: peopleWaiting,
    totalTicketsWaiting: ticketsWaiting,
  })

  return NextResponse.json({ ok: true })
}
