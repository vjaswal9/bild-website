// Renaming a ticket type on an event that already has bookings.
//
// A booking stores a copy of the ticket's name (event_registrations.ticket_name,
// and again inside each named guest in guest_names), and a waiting-list entry
// stores the names it asked for (ticket_preferences). Several admin screens
// find a ticket's price and cost by matching that stored name. If the ticket is
// renamed and the stored names are left behind, those lookups find nothing and
// the event's revenue, cost and profit figures go wrong for every existing
// booking.
//
// So a rename also carries the new name onto the event's bookings and waiting
// list. This file only works out what to change; it does no database work, so
// it can be tested on its own.

export type RenameRegistration = {
  id: string
  ticket_id: string | null
  ticket_name: string | null
  guest_names: unknown
}

export type RenameWaitlistEntry = {
  id: string
  ticket_preferences: unknown
}

export type RenamePlan = {
  registrations: { id: string; patch: { ticket_name?: string; guest_names?: unknown[] } }[]
  waitlist: { id: string; ticket_preferences: unknown[] }[]
  counts: { bookings: number; guests: number; waitlist: number }
  // Rows that carried only the old name, with no id to prove which ticket they
  // meant, while another ticket on the event also has that old name. They are
  // left alone rather than guessed at.
  ambiguous: number
}

type Guest = { ticket_id?: unknown; ticket_name?: unknown } & Record<string, unknown>

export function planTicketRename(opts: {
  ticketId: string
  oldName: string
  newName: string
  // True when a different ticket on the same event also has the old name.
  oldNameShared: boolean
  registrations: RenameRegistration[]
  waitlist: RenameWaitlistEntry[]
}): RenamePlan {
  const { ticketId, oldName, newName, oldNameShared } = opts
  const plan: RenamePlan = {
    registrations: [],
    waitlist: [],
    counts: { bookings: 0, guests: 0, waitlist: 0 },
    ambiguous: 0,
  }
  if (oldName === newName) return plan

  for (const r of opts.registrations) {
    const patch: { ticket_name?: string; guest_names?: unknown[] } = {}

    // The buyer's own ticket. An id is proof; a bare name is only used when
    // no other ticket on the event shares it.
    if (r.ticket_id) {
      if (String(r.ticket_id) === ticketId && r.ticket_name !== newName) {
        patch.ticket_name = newName
        plan.counts.bookings++
      }
    } else if (r.ticket_name === oldName) {
      if (oldNameShared) plan.ambiguous++
      else {
        patch.ticket_name = newName
        plan.counts.bookings++
      }
    }

    // Each named guest carries their own ticket name. Older rows hold plain
    // strings, which have no ticket of their own (they follow the buyer's).
    if (Array.isArray(r.guest_names)) {
      let changed = false
      const guests = (r.guest_names as unknown[]).map(g => {
        if (!g || typeof g !== 'object') return g
        const guest = g as Guest
        if (guest.ticket_id) {
          if (String(guest.ticket_id) === ticketId && guest.ticket_name !== newName) {
            changed = true
            plan.counts.guests++
            return { ...guest, ticket_name: newName }
          }
          return g
        }
        if (guest.ticket_name === oldName) {
          if (oldNameShared) {
            plan.ambiguous++
            return g
          }
          changed = true
          plan.counts.guests++
          return { ...guest, ticket_name: newName }
        }
        return g
      })
      if (changed) patch.guest_names = guests
    }

    if (patch.ticket_name !== undefined || patch.guest_names !== undefined) {
      plan.registrations.push({ id: r.id, patch })
    }
  }

  // Waiting-list entries always record the ticket id alongside the name.
  for (const w of opts.waitlist) {
    if (!Array.isArray(w.ticket_preferences)) continue
    let changed = false
    const prefs = (w.ticket_preferences as unknown[]).map(p => {
      if (!p || typeof p !== 'object') return p
      const pref = p as Guest
      if (String(pref.ticket_id ?? '') === ticketId && pref.ticket_name !== newName) {
        changed = true
        return { ...pref, ticket_name: newName }
      }
      return p
    })
    if (changed) {
      plan.waitlist.push({ id: w.id, ticket_preferences: prefs })
      plan.counts.waitlist++
    }
  }

  return plan
}
