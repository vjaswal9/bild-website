import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import type { GuestEntry } from '@/lib/events'
import { loadRegistration, refundRegistration, type RefundOutcome } from '@/lib/event-refunds'
import { issueUpgradePaymentLink } from '@/lib/event-upgrades'

export const dynamic = 'force-dynamic'

// Reassigns the ticket package held by the buyer and each of their guests,
// for example moving someone from the alcohol package to soft drinks.
//
// The booking is rewritten as a whole rather than one person at a time: the
// buyer's ticket and every guest's ticket come in together and the booking
// total is recomputed from them. That keeps amount_aed, the per-guest prices
// and the door list consistent with each other, which patching one row at a
// time does not.
//
// A downgrade can give the difference back in the same action, which is what
// `refundDifference` asks for. The record is written first and the refund
// issued second: that way a Stripe failure leaves the tickets correct and the
// money untouched, which an admin can retry from the Refund button. Doing it
// the other way round risks a second refund on a retry.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, buyerTicketId, guestTicketIds, note, refundDifference, collectDifference } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  if (!buyerTicketId) return NextResponse.json({ error: 'Please choose the buyer\'s ticket.' }, { status: 400 })

  const { data: reg } = await supabaseAdmin
    .from('event_registrations')
    .select('id, event_id, status, amount_aed, refunded_amount_aed, ticket_id, ticket_name, guest_names, attendee_age, admin_note, stripe_session_id, email, first_name, last_name')
    .eq('id', id)
    .maybeSingle()

  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  if (reg.status === 'refunded') {
    return NextResponse.json({ error: 'This booking has been refunded and cannot be changed.' }, { status: 400 })
  }

  // Every ticket type on this event, active or not: an admin may need to move
  // somebody onto a package that has since been closed for public sale.
  const { data: ticketRows } = await supabaseAdmin
    .from('event_tickets')
    .select('id, name, price_aed, is_child')
    .eq('event_id', reg.event_id)
  const ticketsById = new Map((ticketRows || []).map(t => [String(t.id), t]))

  const { data: eventRow } = await supabaseAdmin
    .from('events')
    .select('title')
    .eq('id', reg.event_id)
    .maybeSingle()

  const buyerTicket = ticketsById.get(String(buyerTicketId))
  if (!buyerTicket) {
    return NextResponse.json({ error: 'That ticket type does not belong to this event.' }, { status: 400 })
  }

  const existingGuests: GuestEntry[] = Array.isArray(reg.guest_names) ? reg.guest_names : []
  const incoming: string[] = Array.isArray(guestTicketIds) ? guestTicketIds : []
  if (incoming.length !== existingGuests.length) {
    return NextResponse.json({
      error: `This booking has ${existingGuests.length} guest${existingGuests.length === 1 ? '' : 's'}, but ${incoming.length} ticket${incoming.length === 1 ? ' was' : 's were'} sent.`,
    }, { status: 400 })
  }

  const guests: GuestEntry[] = []
  for (let i = 0; i < existingGuests.length; i++) {
    const t = ticketsById.get(String(incoming[i]))
    if (!t) {
      return NextResponse.json({ error: `The ticket chosen for guest ${i + 1} does not belong to this event.` }, { status: 400 })
    }
    // Only the ticket changes. The guest's name, dietary requirement and note
    // are carried through untouched. The age is the one exception: an age left
    // against an adult package after a move would read as fact on the door
    // list, so it is dropped with the child ticket it belonged to.
    const carried = { ...existingGuests[i], ticket_name: t.name, price_aed: t.price_aed }
    if (!t.is_child) delete carried.age
    guests.push(carried)
  }

  const oldTotal = Number(reg.amount_aed) || 0
  const newTotal = buyerTicket.price_aed + guests.reduce((s, g) => s + (g.price_aed || 0), 0)
  const difference = Math.round((oldTotal - newTotal) * 100) / 100

  const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 300) : ''
  const changeLine = `${new Date().toLocaleDateString('en-GB')}: tickets changed, ${oldTotal} AED to ${newTotal} AED${trimmedNote ? ` (${trimmedNote})` : ''}`
  const admin_note = [reg.admin_note, changeLine].filter(Boolean).join('\n')

  const { error } = await supabaseAdmin
    .from('event_registrations')
    .update({
      ticket_id: buyerTicket.id,
      ticket_name: buyerTicket.name,
      guest_names: guests,
      amount_aed: newTotal,
      attendee_age: buyerTicket.is_child ? reg.attendee_age : null,
      admin_note,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The Money ledger is deliberately NOT touched here. It records what was
  // collected for the sale (revenue_aed) and subtracts what has been given back
  // (refunded_aed). This used to lower revenue_aed to the new, cheaper total
  // AND then record the refund of the difference, so a downgrade took the same
  // money off twice (a 717 AED booking downgraded to 628 with 89 refunded showed
  // as 539 instead of 628). Leaving revenue_aed alone is right in every case: a
  // downgrade's refund brings the net down by itself, a downgrade with no refund
  // keeps what was collected, and an upgrade is collected separately and gets
  // its own ledger row when it is paid (see the webhook's event_upgrade
  // handling).
  //
  // The per-event figures work from the booking's current ticket prices, so a
  // downgrade is remembered on the booking instead: the value given up is added
  // to downgrade_value_aed and those screens add it back. Best effort, because
  // the column only exists once supabase/event-downgrade-value.sql has been run,
  // and a missing column must never stop a ticket change.
  if (difference > 0) {
    try {
      const { data: cur, error: curErr } = await supabaseAdmin
        .from('event_registrations').select('downgrade_value_aed').eq('id', id).maybeSingle()
      if (!curErr) {
        const before = Number((cur as { downgrade_value_aed?: number | null } | null)?.downgrade_value_aed) || 0
        await supabaseAdmin
          .from('event_registrations')
          .update({ downgrade_value_aed: Math.round((before + difference) * 100) / 100 })
          .eq('id', id)
      }
    } catch (e) {
      console.error('Could not record the value given up by a downgrade:', e)
    }
  }

  // The tickets are now right. If this was a downgrade and the refund was
  // asked for, give the difference back.
  let refund: RefundOutcome | null = null
  let refundError: string | null = null

  if (refundDifference && difference > 0) {
    try {
      // Inside the try: re-reading the booking can fail too, and the ticket
      // change has already been written by this point.
      const fresh = await loadRegistration(String(id))
      if (fresh) {
        refund = await refundRegistration(fresh, {
          amountAed: difference,
          // A downgrade is not a cancellation, so no admin fee and the person
          // keeps their place.
          note: trimmedNote || `ticket change, ${oldTotal} AED to ${newTotal} AED`,
        })
      }
    } catch (e) {
      // The ticket change stands. Only the money did not move, and the
      // admin is told exactly what is still owed.
      refundError = e instanceof Error ? e.message : 'The refund could not be processed.'
    }
  }

  // The other direction: an upgrade. Stripe cannot charge more to a card
  // already used for the original checkout, so - if asked - email a fresh,
  // token-gated payment link for just the difference instead.
  let upgradeLink: { ok: true; payUrl: string } | { ok: false; error: string } | null = null

  if (collectDifference && difference < 0 && reg.email) {
    upgradeLink = await issueUpgradePaymentLink({
      registrationId: String(id),
      amountAed: Math.abs(difference),
      note: trimmedNote,
      eventTitle: eventRow?.title || 'your event',
      ticketName: buyerTicket.name,
      to: reg.email,
      firstName: reg.first_name,
    })
  }

  return NextResponse.json({
    ok: true,
    oldTotalAed: oldTotal,
    newTotalAed: newTotal,
    // Positive means the booking is now worth less and money is owed back.
    // Negative means an upgrade: BILD needs to collect the difference, which
    // cannot be charged automatically to a card that has already been used.
    differenceAed: difference,
    refund,
    refundError,
    upgradeLink,
  })
}
