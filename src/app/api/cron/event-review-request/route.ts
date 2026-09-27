import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEventReviewRequest } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Asks event attendees for a Google review, as a trickle rather than a burst.
//
// THE PROBLEM THIS SOLVES: around twenty genuine reviews were filtered out by
// Google. The cause is almost certainly the shape of the ask, not the reviews
// themselves - thirty members reviewing at the same event, on the same venue
// wifi, inside an hour, mostly from accounts with no review history. Google's
// spam filter treats that as coordinated and removes the lot, and filtered
// reviews have no self-service appeal, so they are effectively gone.
//
// Every number below exists to break that pattern.

// Not before this. Somebody asked on the night is standing in the venue on its
// wifi, which is the exact thing to avoid, and they have not had time to form
// an opinion either.
const MIN_DAYS_AFTER = 2

// Not after this. An ask three weeks later reads as odd and converts poorly.
const MAX_DAYS_AFTER = 21

// The important one. At most this many asks go out across the whole site per
// day, so a 120-person event is spread over ten days instead of landing in one
// hour. Raising it much above twenty starts to recreate the burst.
const PER_DAY = Number(process.env.REVIEW_REQUESTS_PER_DAY) || 12

// A regular attendee should not be asked after every event. Someone who has
// already left a review has nothing more to give, and someone who ignored the
// last ask will ignore this one too.
const COOLDOWN_DAYS = 120

type Candidate = { eventId: string; eventTitle: string; email: string; firstName: string | null; endedAt: number }

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const cronOk =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  const adminOk = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!cronOk && !adminOk) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // An admin can see exactly who would be emailed without sending anything.
  // This one sends to real members, so it should be easy to look first.
  const dryRun = adminOk && req.nextUrl.searchParams.get('dry') === '1'

  const placeId = process.env.GOOGLE_PLACE_ID
  if (!placeId) {
    return NextResponse.json({ error: 'GOOGLE_PLACE_ID is not set, so there is no review link to send' }, { status: 500 })
  }
  // Built directly rather than via getGoogleReviews: this is the only field
  // needed and it is derived from the place id alone, so there is no reason to
  // call the Places API from a cron.
  const reviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const windowStart = new Date(now - MAX_DAYS_AFTER * day).toISOString()
  const windowEnd = new Date(now - MIN_DAYS_AFTER * day).toISOString()

  // Events that finished inside the window. event_date is the start, so the
  // window is applied to it and end_date is checked afterwards for the few
  // events that run over more than one day.
  const { data: events, error: eventsErr } = await supabaseAdmin
    .from('events')
    .select('id, title, event_date, end_date')
    .eq('status', 'published')
    .gte('event_date', windowStart)
    .lte('event_date', windowEnd)
    .order('event_date', { ascending: false })
  if (eventsErr) {
    return NextResponse.json({ error: `Could not read events: ${eventsErr.message}` }, { status: 500 })
  }

  const finished = (events || []).filter(e => {
    const ended = new Date(e.end_date || e.event_date).getTime()
    return ended <= now - MIN_DAYS_AFTER * day
  })
  if (!finished.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no events finished in the window' })
  }

  const eventIds = finished.map(e => e.id)
  const titleById = new Map(finished.map(e => [e.id, e.title as string]))
  const endedById = new Map(finished.map(e => [e.id, new Date(e.end_date || e.event_date).getTime()]))

  // Everyone who actually attended: paid, not refunded.
  const { data: regs, error: regsErr } = await supabaseAdmin
    .from('event_registrations')
    .select('event_id, email, first_name, created_at')
    .in('event_id', eventIds)
    .eq('status', 'paid')
    .is('refunded_at', null)
    .order('created_at', { ascending: true })
  if (regsErr) {
    return NextResponse.json({ error: `Could not read registrations: ${regsErr.message}` }, { status: 500 })
  }

  // Already asked, for these events or for anything else recently.
  //
  // These two errors are fatal on purpose. If the table is missing - the SQL
  // in supabase/event-review-requests.sql has not been run - then swallowing
  // the error would leave both sets empty, every attendee would look unasked,
  // and the run would email people it could not then record. Tomorrow it would
  // email the same people again. Better to send nothing and say why.
  const { data: askedForEvents, error: askedErr } = await supabaseAdmin
    .from('event_review_requests')
    .select('event_id, email')
    .in('event_id', eventIds)
  if (askedErr) {
    return NextResponse.json(
      { error: `Could not read event_review_requests, so nothing was sent: ${askedErr.message}. Has supabase/event-review-requests.sql been run?` },
      { status: 500 },
    )
  }

  const { data: askedRecently, error: cooldownErr } = await supabaseAdmin
    .from('event_review_requests')
    .select('email')
    .gte('sent_at', new Date(now - COOLDOWN_DAYS * day).toISOString())
  if (cooldownErr) {
    return NextResponse.json(
      { error: `Could not read the cooldown list, so nothing was sent: ${cooldownErr.message}` },
      { status: 500 },
    )
  }

  const key = (eventId: string, email: string) => `${eventId}|${email.trim().toLowerCase()}`
  const doneForEvent = new Set((askedForEvents || []).map(r => key(r.event_id, r.email)))
  const inCooldown = new Set((askedRecently || []).map(r => r.email.trim().toLowerCase()))

  const seenThisRun = new Set<string>()
  const candidates: Candidate[] = []
  for (const r of regs || []) {
    const email = (r.email || '').trim()
    if (!email.includes('@')) continue
    const lower = email.toLowerCase()
    if (doneForEvent.has(key(r.event_id, email))) continue
    if (inCooldown.has(lower)) continue
    // One person can hold several bookings for the same event.
    if (seenThisRun.has(lower)) continue
    seenThisRun.add(lower)
    candidates.push({
      eventId: r.event_id,
      eventTitle: titleById.get(r.event_id) || 'a BILD event',
      email,
      firstName: r.first_name || null,
      endedAt: endedById.get(r.event_id) || 0,
    })
  }

  // Oldest event first, because eligibility expires. With two events live and
  // 102 people to get through at twelve a day, ordering by booking time mixed
  // the two together and left the older event's attendees to be sent last -
  // exactly the ones whose 21-day window closes first. Sorting this way means
  // nobody ages out while a less urgent ask goes ahead of them.
  candidates.sort((a, b) => a.endedAt - b.endedAt)

  const batch = candidates.slice(0, PER_DAY)

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      wouldSend: batch.length,
      stillWaiting: candidates.length - batch.length,
      perDay: PER_DAY,
      reviewUrl,
      recipients: batch.map(c => ({ email: c.email, firstName: c.firstName, event: c.eventTitle })),
    })
  }

  let sent = 0
  const failed: { email: string; error: string }[] = []
  for (const c of batch) {
    try {
      await sendEventReviewRequest({
        to: c.email,
        firstName: c.firstName || undefined,
        eventTitle: c.eventTitle,
        reviewUrl,
      })
      // Recorded only after the send succeeds, so a failed email is retried
      // tomorrow rather than silently counted as asked.
      const { error } = await supabaseAdmin
        .from('event_review_requests')
        .insert({ event_id: c.eventId, email: c.email, first_name: c.firstName })
      sent++
      if (error) {
        // Sent but unrecorded means this person is asked again tomorrow. One
        // duplicate is recoverable; a whole batch of them every day is not, so
        // stop here and let the run report it.
        console.error('review request: sent but could not record', c.email, error.message)
        return NextResponse.json({
          ok: false,
          sent,
          error: `Sent ${sent} but could not record the last one (${error.message}). Stopped to avoid emailing the same people again tomorrow.`,
        }, { status: 500 })
      }
    } catch (e) {
      failed.push({ email: c.email, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    stillWaiting: Math.max(0, candidates.length - sent),
    perDay: PER_DAY,
    events: finished.length,
    failed: failed.length ? failed : undefined,
  })
}
