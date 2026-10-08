// Works out what taking one person off a paid booking does to that booking.
// Pure: no database, no Stripe, so it can be tested on its own and the route
// stays a thin wrapper around it.
//
// A booking is one row: the person who paid (first_name, ticket_id, ...) plus a
// list of guests. Everything else on the site, the door list, the exports, the
// seating groups, the capacity count, reads that row. So removing someone means
// making the row describe only the people still coming, rather than flagging
// them and teaching every screen to skip the flag.
//
// When the person who PAID is the one removed, the first guest takes over as the
// booking's lead (name, ticket, dietary, age) and the original payer is kept in
// payer_first_name / payer_last_name. The email address, phone and Stripe
// payment stay as they were: those are how the payer is reached and refunded.
import type { GuestEntry, RemovedPerson } from './events'

export type RegForRemoval = {
  first_name: string
  last_name: string | null
  title?: string | null
  ticket_id: string | null
  ticket_name: string | null
  dietary?: string | null
  dietary_note?: string | null
  attendee_age?: number | null
  quantity: number | null
  amount_aed: number | null
  guest_names: GuestEntry[] | null
  admin_note: string | null
  is_complimentary?: boolean | null
  removed_people?: RemovedPerson[] | null
  payer_first_name?: string | null
  payer_last_name?: string | null
}

export type TicketLite = { id: string; name: string; price_aed: number }

export type RemovalPlan =
  | {
      ok: true
      update: Record<string, unknown>
      removed: RemovedPerson
      // Set when a guest took over as lead, so the screen can say who.
      promoted: string | null
      payerFirstName: string
      // What the person's ticket was worth and what BILD keeps from it.
      priceAed: number
      payoutAed: number
    }
  | { ok: false; error: string }

const round2 = (n: number) => Math.round(n * 100) / 100

// "Mary Jane Smith" -> first "Mary Jane", last "Smith". One word -> no last name.
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first: parts[0] || '', last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

export function planRemoval(
  reg: RegForRemoval,
  tickets: TicketLite[],
  who: 'buyer' | number,
  money: { grossAed: number; adminFeeAed: number },
  note: string,
  now: Date,
): RemovalPlan {
  const guests: GuestEntry[] = Array.isArray(reg.guest_names) ? reg.guest_names : []
  if (guests.length < 1) {
    return { ok: false, error: 'This booking has only one person on it. Use "Refund minus admin fee" to cancel it.' }
  }
  if (who !== 'buyer' && (!Number.isInteger(who) || who < 0 || who >= guests.length)) {
    return { ok: false, error: 'That person is not on this booking.' }
  }

  const buyerTicket = tickets.find(t => t.id === reg.ticket_id)
    || tickets.find(t => t.name === reg.ticket_name)
  const buyerName = `${reg.first_name} ${reg.last_name || ''}`.trim()

  let name: string
  let ticketName: string | null
  let rawPrice: number
  if (who === 'buyer') {
    name = buyerName
    ticketName = reg.ticket_name
    rawPrice = Number(buyerTicket?.price_aed) || 0
  } else {
    const g = guests[who]
    name = String(g.name || '').trim() || `Guest ${who + 1}`
    ticketName = g.ticket_name || null
    rawPrice = Number(g.price_aed) || 0
  }
  // A complimentary booking was never paid for, so nothing of its ticket value
  // is ever refunded or kept.
  const priceAed = reg.is_complimentary ? 0 : round2(rawPrice)

  const gross = round2(Number(money.grossAed) || 0)
  const fee = round2(Number(money.adminFeeAed) || 0)
  if (gross < 0 || fee < 0) return { ok: false, error: 'Amounts cannot be negative.' }
  if (gross > priceAed + 0.005) {
    return { ok: false, error: `This person's ticket was ${priceAed} AED, so at most ${priceAed} AED can be refunded for them.` }
  }
  if (fee > gross + 0.005) return { ok: false, error: 'The admin fee cannot be more than the amount being refunded.' }
  const payoutAed = round2(gross - fee)
  const keptAed = round2(priceAed - payoutAed)

  const entry: RemovedPerson = {
    name,
    role: who === 'buyer' ? 'buyer' : 'guest',
    ticket_name: ticketName,
    price_aed: priceAed,
    refunded_aed: payoutAed,
    kept_aed: keptAed,
    at: now.toISOString(),
    ...(note ? { note } : {}),
  }

  const update: Record<string, unknown> = {}
  let remainingGuests: GuestEntry[]
  let promoted: string | null = null

  if (who === 'buyer') {
    const lead = guests[0]
    remainingGuests = guests.slice(1)
    const { first, last } = splitName(String(lead.name || ''))
    const match = tickets.filter(t => t.name === lead.ticket_name)
    promoted = String(lead.name || '').trim() || 'the first guest'
    Object.assign(update, {
      first_name: first || promoted,
      last_name: last,
      title: lead.title || null,
      ticket_name: lead.ticket_name || null,
      ticket_id: match.length === 1 ? match[0].id : null,
      dietary: lead.dietary || null,
      dietary_note: lead.dietary_note || null,
      attendee_age: lead.age ?? null,
      payer_first_name: reg.payer_first_name || reg.first_name,
      payer_last_name: reg.payer_last_name ?? (reg.last_name || ''),
    })
  } else {
    remainingGuests = guests.filter((_, i) => i !== who)
  }

  const today = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' })
  const line = `${today}: ${name} removed from the booking${who === 'buyer' ? ` (the person who paid; ${promoted} is now the lead name, contact details unchanged)` : ''}. `
    + (payoutAed > 0 ? `Refunded ${payoutAed} AED` : 'No refund')
    + (keptAed > 0 && priceAed > 0 ? `, ${keptAed} AED kept` : '')
    + (note ? ` (${note})` : '')

  Object.assign(update, {
    guest_names: remainingGuests,
    quantity: remainingGuests.length + 1,
    amount_aed: Math.max(0, round2((Number(reg.amount_aed) || 0) - priceAed)),
    removed_people: [...(reg.removed_people || []), entry],
    admin_note: [reg.admin_note, line].filter(Boolean).join('\n'),
  })

  return {
    ok: true,
    update,
    removed: entry,
    promoted,
    payerFirstName: reg.payer_first_name || reg.first_name,
    priceAed,
    payoutAed,
  }
}
