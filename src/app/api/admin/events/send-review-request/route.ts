import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendEventReviewRequest } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// The manual replacement for the paused automated cron
// (src/app/api/cron/event-review-request/route.ts): an admin picks exactly
// who to ask, on the Send Google Review Requests page, instead of it
// happening on a schedule.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const b = await req.json().catch(() => null)
  const items = Array.isArray(b?.items) ? b.items : []
  if (items.length === 0) return NextResponse.json({ error: 'Nothing selected.' }, { status: 400 })
  // A large accidental selection ("select all" on a 200-person event, twice)
  // is a mis-click, not a real request - cheap to cap, expensive to send.
  if (items.length > 200) {
    return NextResponse.json({ error: 'That is more than 200 at once. Send in smaller batches.' }, { status: 400 })
  }

  const placeId = process.env.GOOGLE_PLACE_ID
  if (!placeId) {
    return NextResponse.json({ error: 'GOOGLE_PLACE_ID is not set, so there is no review link to send.' }, { status: 500 })
  }
  const reviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`

  const regIds: string[] = items.map((i: { registrationId?: string }) => i.registrationId).filter(Boolean)
  const { data: regs, error: regsErr } = await supabaseAdmin
    .from('event_registrations')
    .select('id, event_id, first_name, email, status')
    .in('id', regIds)
  if (regsErr) return NextResponse.json({ error: regsErr.message }, { status: 500 })

  const eventIds = Array.from(new Set((regs || []).map(r => r.event_id)))
  const { data: eventRows, error: eventsErr } = await supabaseAdmin
    .from('events')
    .select('id, title')
    .in('id', eventIds)
  if (eventsErr) return NextResponse.json({ error: eventsErr.message }, { status: 500 })
  const titleById = new Map((eventRows || []).map(e => [e.id, e.title as string]))

  const sent: string[] = []
  const failed: { email: string; error: string }[] = []

  for (const r of regs || []) {
    // Never emails an unpaid attempt: it is a fake, an abandoned checkout, or
    // simply not somebody who attended.
    if (r.status !== 'paid') {
      failed.push({ email: r.email, error: 'booking is not marked paid' })
      continue
    }
    try {
      await sendEventReviewRequest({
        to: r.email,
        firstName: r.first_name || undefined,
        eventTitle: titleById.get(r.event_id) || 'a BILD event',
        reviewUrl,
      })
      // Recorded in the same table the automated version used, so an admin
      // sending manually and the (paused) automated version can never both
      // ask the same booking without it showing on this page.
      //
      // Not a Postgres upsert: the table's uniqueness is a case-insensitive
      // index on lower(email), which an upsert's onConflict cannot target (it
      // only matches a literal column list, not an expression index) - it
      // would throw "no unique or exclusion constraint matching ON CONFLICT"
      // the first time the same address appeared in two different cases.
      // Checking first and updating or inserting works with that index either way.
      const { data: existing } = await supabaseAdmin
        .from('event_review_requests')
        .select('id')
        .eq('event_id', r.event_id)
        .ilike('email', r.email)
        .maybeSingle()
      const { error } = existing
        ? await supabaseAdmin
            .from('event_review_requests')
            .update({ sent_at: new Date().toISOString(), first_name: r.first_name })
            .eq('id', existing.id)
        : await supabaseAdmin
            .from('event_review_requests')
            .insert({ event_id: r.event_id, email: r.email, first_name: r.first_name, sent_at: new Date().toISOString() })
      if (error) console.error('review request: sent but could not record', r.email, error.message)
      sent.push(r.email)
    } catch (e) {
      failed.push({ email: r.email, error: e instanceof Error ? e.message : 'send failed' })
    }
  }

  return NextResponse.json({ ok: true, sent, failed })
}
