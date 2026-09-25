import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Clears out event checkouts that were started and never paid for.
//
// A booking row is written before the buyer is sent to Stripe, so anyone who
// closes the payment page leaves one behind. They never reach the door list or
// the money figures, but they pile up in the admin looking like bookings and
// make the attendee list harder to read.
//
// A day is deliberately generous. A Stripe checkout session expires after 24
// hours, so nothing removed here could still be paid for.
const MIN_AGE_HOURS = 24

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  if (!authed) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000).toISOString()

  const { data: stale, error } = await supabaseAdmin
    .from('event_registrations')
    .select('id, email, amount_aed, created_at, stripe_session_id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const candidates = stale || []
  if (candidates.length === 0) return NextResponse.json({ ok: true, deleted: 0, kept: 0 })

  // Two safety nets before deleting anything. A booking that has a Stripe
  // session recorded, or money against it in the ledger, was paid for and is
  // only sitting at 'pending' because something went wrong. Those are worth
  // investigating, never worth deleting.
  // The error here used to be discarded, which quietly disarmed the safety
  // net it belongs to: a failed read gave an empty set, so every candidate
  // looked unpaid and was deleted. The rows most likely to be affected are
  // exactly the ones this check exists to protect, a booking paid for but not
  // yet recorded. Rather than delete on a guess, abandon the run.
  const { data: paidRows, error: paidError } = await supabaseAdmin
    .from('payments')
    .select('reference_id')
    .in('reference_id', candidates.map(r => r.id))
  if (paidError) {
    console.error('Could not check the ledger before tidying checkouts, deleting nothing:', paidError)
    return NextResponse.json(
      { ok: false, error: 'Could not check the payment ledger, so nothing was deleted.' },
      { status: 503 },
    )
  }
  const hasMoney = new Set((paidRows || []).map(p => p.reference_id))

  const safe = candidates.filter(r => !r.stripe_session_id && !hasMoney.has(r.id))
  const kept = candidates.filter(r => r.stripe_session_id || hasMoney.has(r.id))

  if (kept.length) {
    console.error('Unpaid bookings that look paid for, left alone:', kept.map(r => ({ id: r.id, email: r.email })))
  }

  let deleted = 0
  if (safe.length) {
    const { error: delError } = await supabaseAdmin
      .from('event_registrations')
      .delete()
      .in('id', safe.map(r => r.id))
    if (delError) return NextResponse.json({ ok: false, error: delError.message }, { status: 500 })
    deleted = safe.length
  }

  // Directory statistics housekeeping. The de-dupe table only needs three days
  // of history, and this is the job that already runs nightly - the monthly
  // stats email is far too infrequent to keep it trimmed.
  const { data: pruned, error: pruneErr } = await supabaseAdmin.rpc('prune_directory_dedupe')
  if (pruneErr) console.error('directory stats: dedupe prune failed', pruneErr.message)

  return NextResponse.json({
    ok: true,
    deleted,
    kept: kept.length,
    dedupeRowsPruned: pruneErr ? null : (pruned ?? 0),
    // Named so a run that removed something unexpected can be traced in the
    // Vercel logs afterwards.
    removed: safe.map(r => ({ email: r.email, amountAed: r.amount_aed, startedAt: r.created_at })),
  })
}
