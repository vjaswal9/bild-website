import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import type { GuestEntry } from '@/lib/events'
import { loadRegistration, refundRegistration, type RefundOutcome } from '@/lib/event-refunds'

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

  const { id, buyerTicketId, guestTicketIds, note, refundDifference } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  if (!buyerTicketId) return NextResponse.json({ error: 'Please choose the buyer\'s ticket.' }, { status: 400 })

  const { data: reg } = await supabaseAdmin
    .from('event_registrations')
    .select('id, event_id, status, amount_aed, refunded_amount_aed, ticket_id, ticket_name, guest_names, attendee_age, admin_note, stripe_session_id')
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

  // The ledger records what this booking is now worth to BILD. The gross and
  // the card fee the buyer paid at checkout are left alone: that money did
  // change hands, and a refund is what moves it back.
  if (reg.stripe_session_id) {
    try {
      await supabaseAdmin
        .from('payments')
        .update({ revenue_aed: newTotal })
        .eq('stripe_session_id', reg.stripe_session_id)
    } catch (e) {
      console.error('Could not update the payment ledger after a ticket change:', e)
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
  })
}
