// Which ticket types someone on an event's waiting list wants.
//
// A waiting-list entry has always had one number, tickets_wanted. It still does
// (the total), so the dashboard, the seats-free comparison and every report keep
// working. From the point this was added, a new entry can also carry the mix of
// ticket types asked for in ticket_preferences. Older entries have none and are
// shown exactly as before.

export type WaitTicketChoice = { ticket_id: string; ticket_name: string; quantity: number }

export const WAITLIST_MAX_TICKETS = 10

type TicketRow = { id: string; name: string; active?: boolean | null; event_id?: string | null }

// Turns what the browser sent ([{ ticketId, quantity }]) into a clean list, or
// says what is wrong. Never trusts the browser's names or ids: each id must be
// an active ticket type of THIS event, and the saved name comes from the event.
export function cleanTicketChoices(
  raw: unknown,
  eventTickets: TicketRow[],
): { ok: true; choices: WaitTicketChoice[]; total: number } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'Please choose your registration type.' }
  const byId = new Map(eventTickets.filter(t => t.active !== false).map(t => [String(t.id), t]))
  const merged = new Map<string, number>()
  for (const item of raw) {
    const id = String((item as { ticketId?: unknown })?.ticketId ?? '')
    const q = Number((item as { quantity?: unknown })?.quantity)
    if (!Number.isFinite(q) || q < 0 || !Number.isInteger(q)) return { ok: false, error: 'Please check the number of places.' }
    if (q === 0) continue
    if (!byId.has(id)) return { ok: false, error: 'One of those registration types is not available for this event.' }
    merged.set(id, (merged.get(id) || 0) + q)
  }
  const choices: WaitTicketChoice[] = Array.from(merged.entries()).map(([id, quantity]) => ({
    ticket_id: id, ticket_name: byId.get(id)!.name, quantity,
  }))
  const total = choices.reduce((s, c) => s + c.quantity, 0)
  if (total < 1) return { ok: false, error: 'Please choose at least one place.' }
  if (total > WAITLIST_MAX_TICKETS) return { ok: false, error: `The waiting list takes up to ${WAITLIST_MAX_TICKETS} places per person. For more, please email events@bild.ae.` }
  return { ok: true, choices, total }
}

// "2 x Dinner + drinks, 1 x Soft drinks"
export function describeTicketChoices(choices: { ticket_name?: string; name?: string; quantity: number }[]): string {
  return choices.map(c => `${c.quantity} x ${c.ticket_name || c.name || 'Ticket'}`).join(', ')
}

// What is stored (and what an old entry has none of) read back safely.
export function readTicketChoices(value: unknown): WaitTicketChoice[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(v => v && typeof v === 'object')
    .map(v => ({
      ticket_id: String((v as WaitTicketChoice).ticket_id || ''),
      ticket_name: String((v as WaitTicketChoice).ticket_name || 'Ticket'),
      quantity: Number((v as WaitTicketChoice).quantity) || 0,
    }))
    .filter(c => c.quantity > 0)
}

// How many of each ticket type the people still waiting want. Entries from before
// ticket types were asked for are not counted here: they have no type to count.
export function waitingTotalsByType(
  entries: { status?: string; ticket_preferences?: unknown }[],
): { name: string; quantity: number }[] {
  const totals = new Map<string, number>()
  for (const e of entries) {
    if (e.status !== 'waiting') continue
    for (const c of readTicketChoices(e.ticket_preferences)) totals.set(c.ticket_name, (totals.get(c.ticket_name) || 0) + c.quantity)
  }
  return Array.from(totals.entries()).map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity)
}
