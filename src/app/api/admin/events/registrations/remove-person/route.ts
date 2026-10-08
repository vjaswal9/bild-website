import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { loadRegistration, refundRegistration, type RefundOutcome } from '@/lib/event-refunds'
import { planRemoval, type RegForRemoval } from '@/lib/remove-person'

export const dynamic = 'force-dynamic'

// Takes ONE person off a paid booking: the buyer or any guest.
//
// What it does, in one go:
//  - the booking now describes only the people still coming (name list, ticket
//    count, booking value), so the door list, exports, seating groups, capacity
//    and waitlist seat count are all right without any of them being told;
//  - the seat is free for someone else;
//  - their ticket is refunded to the card, less an admin fee if one is kept;
//  - who was removed, and what was refunded and kept, is written to the booking.
//
// The booking is written first and the money moved second, like a ticket
// downgrade: if Stripe fails, the list is right and nothing has been paid back,
// and the admin is told exactly what is still owed. Doing it the other way
// round risks a second refund on a retry.
//
// If the person who paid is the one removed, the first guest becomes the
// booking's lead name. The email, phone and Stripe payment stay as they were,
// so the payer is still reached and still refunded.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id : ''
  const who: 'buyer' | number | null = body?.who === 'buyer' ? 'buyer' : Number.isInteger(body?.who) ? body.who : null
  if (!id || who === null) return NextResponse.json({ error: 'Choose who is being removed.' }, { status: 400 })
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : ''

  const { data: reg, error: readErr } = await supabaseAdmin
    .from('event_registrations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: 'The booking could not be read just now. Please try again.' }, { status: 503 })
  if (!reg) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  if (reg.status !== 'paid') {
    return NextResponse.json({ error: 'Only a paid booking can have someone removed.' }, { status: 400 })
  }
  if (Number(reg.upgrade_due_aed) > 0) {
    return NextResponse.json({ error: 'This booking has an unpaid ticket upgrade. Settle or cancel that first.' }, { status: 400 })
  }

  const { data: ticketRows } = await supabaseAdmin
    .from('event_tickets')
    .select('id, name, price_aed')
    .eq('event_id', reg.event_id)
  const tickets = (ticketRows || []).map(t => ({ id: String(t.id), name: String(t.name), price_aed: Number(t.price_aed) || 0 }))

  const plan = planRemoval(
    reg as RegForRemoval,
    tickets,
    who,
    { grossAed: Number(body?.grossAed) || 0, adminFeeAed: Number(body?.adminFeeAed) || 0 },
    note,
    new Date(),
  )
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 400 })

  // Guarded write: only if the booking is still exactly as it was read, so two
  // admins (or a double click) cannot remove the same person twice.
  const { data: written, error: writeErr } = await supabaseAdmin
    .from('event_registrations')
    .update(plan.update)
    .eq('id', id)
    .eq('status', 'paid')
    .eq('quantity', reg.quantity)
    .select('id')
  if (writeErr) {
    const missingColumns = writeErr.code === '42703' || /removed_people|payer_first_name|payer_last_name/.test(writeErr.message || '')
    if (missingColumns) {
      return NextResponse.json({ error: 'This needs one database update first (supabase/event-remove-person.sql). Nothing was changed.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not update the booking. Nothing was changed.' }, { status: 500 })
  }
  if (!written || written.length === 0) {
    return NextResponse.json({ error: 'This booking changed while you were looking at it. Reload and check before removing anyone.' }, { status: 409 })
  }

  // Money. Nothing to send for a free ticket, a complimentary booking, or an
  // admin who chose to keep the lot.
  let refund: RefundOutcome | null = null
  let refundError: string | null = null
  if (plan.payoutAed > 0 && Number(reg.amount_aed) > 0) {
    try {
      const fresh = await loadRegistration(id)
      if (!fresh) throw new Error('The booking could not be found to refund.')
      refund = await refundRegistration(
        {
          ...fresh,
          // The refund goes to, and the email is addressed to, the person who paid.
          first_name: plan.payerFirstName,
          ticket_name: plan.removed.ticket_name,
        },
        {
          amountAed: plan.payoutAed,
          note: `${plan.removed.name} removed from the booking${note ? `, ${note}` : ''}`,
          adminFeeAed: plan.removed.kept_aed > 0 ? plan.removed.kept_aed : undefined,
          keepOpen: true,
          extraValueAed: (plan.update.removed_people as { price_aed?: number }[]).reduce((s, p) => s + (Number(p.price_aed) || 0), 0),
          removedPersonName: plan.removed.name,
        },
      )
    } catch (e) {
      refundError = e instanceof Error ? e.message : 'The refund could not be processed.'
      // The record must not claim money went back when it did not.
      const trail = (plan.update.removed_people as unknown[]).slice()
      const last = trail[trail.length - 1] as Record<string, unknown>
      trail[trail.length - 1] = { ...last, refunded_aed: 0, kept_aed: plan.priceAed, note: `${(last.note as string) || ''}${last.note ? ', ' : ''}refund of ${plan.payoutAed} AED not sent yet` }
      await supabaseAdmin.from('event_registrations').update({ removed_people: trail }).eq('id', id)
    }
  }

  return NextResponse.json({
    ok: true,
    removed: plan.removed.name,
    promoted: plan.promoted,
    peopleLeft: (plan.update.quantity as number) ?? null,
    refund,
    refundError,
    owedAed: refundError ? plan.payoutAed : 0,
  })
}
