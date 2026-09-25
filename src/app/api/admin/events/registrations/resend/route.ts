import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendEventConfirmation } from '@/lib/email'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'
import type { GuestEntry } from '@/lib/events'
import { getPaymentSummary } from '@/lib/stripe-charge'

export const dynamic = 'force-dynamic'

// Corrects the email address on a booking, if needed, and sends the ticket
// confirmation again.
//
// Exists because a mistyped address is the one failure the customer cannot fix
// themselves: they have paid, the booking is right, and the only thing wrong is
// where the confirmation was posted to.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, email } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: reg } = await supabaseAdmin
    .from('event_registrations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!reg) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (reg.status !== 'paid') {
    return NextResponse.json({ error: 'Only a paid booking has a confirmation to send.' }, { status: 400 })
  }

  // An address may be supplied to correct the record at the same time.
  let target = reg.email as string
  if (email) {
    if (!isValidEmail(String(email))) {
      return NextResponse.json({ error: 'That email address does not look valid.' }, { status: 400 })
    }
    target = normaliseEmail(String(email))
    if (target !== reg.email) {
      const line = `${new Date().toLocaleDateString('en-GB')}: email corrected from ${reg.email} to ${target}`
      const { error } = await supabaseAdmin
        .from('event_registrations')
        .update({ email: target, admin_note: [reg.admin_note, line].filter(Boolean).join('\n') })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data: ev } = await supabaseAdmin
    .from('events')
    .select('title, slug, event_date, end_date, venue, google_maps_url')
    .eq('id', reg.event_id)
    .maybeSingle()

  // A resend must say the same as the original: what the card was actually
  // charged, and a link to the Stripe receipt. Neither was passed before, so a
  // resent confirmation showed only the ticket value and no receipt.
  const payment = await getPaymentSummary(reg.stripe_session_id as string | null)
  let totalPaidAed = payment.totalPaidAed
  if (totalPaidAed == null && reg.stripe_session_id) {
    // Stripe unreachable: the money ledger already holds what was charged.
    const { data: ledger } = await supabaseAdmin
      .from('payments')
      .select('gross_aed')
      .eq('stripe_session_id', reg.stripe_session_id)
      .maybeSingle()
    if (ledger?.gross_aed != null) totalPaidAed = Number(ledger.gross_aed)
  }

  const outcome = await sendEventConfirmation({
    to: target,
    firstName: reg.first_name,
    lastName: reg.last_name,
    eventTitle: ev?.title || 'BILD Event',
    ticketName: reg.ticket_name,
    eventDate: ev?.event_date || new Date().toISOString(),
    amountAed: reg.amount_aed ?? 0,
    totalPaidAed,
    receiptUrl: payment.receiptUrl,
    quantity: reg.quantity ?? 1,
    guests: (reg.guest_names as GuestEntry[]) || [],
    attendeeAge: reg.attendee_age as number | null,
    venue: ev?.venue,
    googleMapsUrl: ev?.google_maps_url,
    eventSlug: ev?.slug,
    eventEndDate: ev?.end_date,
  })

  // Say plainly whether it went. Reporting success on an email that was never
  // sent is how the original problem stayed hidden for a day.
  if (outcome && outcome.ok === false) {
    return NextResponse.json(
      { error: `The address was saved, but the confirmation could not be sent: ${outcome.reason}` },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, sentTo: target })
}
