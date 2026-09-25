import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'
import { sendWaitlistJoinedEmail, sendWaitlistJoinedAdminAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Public: join the waitlist for a sold-out event.
export async function POST(req: NextRequest) {
  if (isRateLimited(`waitlist:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
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
  const ticketsWanted = Number.isFinite(wanted) ? Math.min(Math.max(Math.round(wanted), 1), 10) : 1

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
  const { error } = existing
    ? await supabaseAdmin.from('event_waitlist').update(fields).eq('id', existing.id)
    : await supabaseAdmin.from('event_waitlist').insert([{ ...fields, event_id: eventId, email: normalised }])

  if (error) {
    console.error('Waitlist write failed:', error)
    return NextResponse.json({ error: 'Could not add you to the waitlist. Please try again.' }, { status: 500 })
  }

  const { count } = await supabaseAdmin
    .from('event_waitlist')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'waiting')

  await sendWaitlistJoinedEmail({
    to: normalised,
    firstName,
    eventTitle: event.title,
    ticketsWanted,
  })
  await sendWaitlistJoinedAdminAlert({
    eventTitle: event.title,
    name: `${firstName} ${lastName}`.trim(),
    email: normalised,
    phone: phone || undefined,
    ticketsWanted,
    totalWaiting: count ?? 0,
  })

  return NextResponse.json({ ok: true })
}
