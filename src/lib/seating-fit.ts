// Pure seating arithmetic, shared by the booking form's warning (via its API
// route) and the admin Seating panel. No imports on purpose: it runs in the
// browser and on the server.
//
// The question it answers is "once everybody who has already booked has been
// seated, is there still a table with room for one more party of N?" Seating
// everyone already booked comes first, because moving a new big party in
// ahead of them would only push the problem onto people who booked earlier.

// Smaller parties are never warned: a couple fits almost anywhere.
export const WARN_FROM_PARTY_SIZE = 6

// "A few tables left" means this many or fewer could still take the party.
const TIGHT_AT_OR_BELOW = 2

export type SeatingFit = 'ok' | 'tight' | 'nofit'

// Seats still free at each table after every existing party has been placed,
// largest first, each at the first table with room - the same order and rule
// Auto-assign uses. A party bigger than one table is something an admin seats
// across several by hand, so it is counted as taking whole tables.
export function seatsLeftPerTable(partySizes: number[], tableCount: number, seatsPerTable: number): number[] {
  const left: number[] = Array(tableCount).fill(seatsPerTable)
  const sorted = [...partySizes].sort((a, b) => b - a)
  for (const size of sorted) {
    if (size > seatsPerTable) {
      const needed = Math.ceil(size / seatsPerTable)
      const byRoom = left.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r)
      for (let k = 0; k < needed && k < byRoom.length; k++) left[byRoom[k].i] = 0
      continue
    }
    const idx = left.findIndex(r => r >= size)
    if (idx !== -1) left[idx] -= size
  }
  return left
}

// Tables with every seat still free.
export function wholeTablesFree(left: number[], seatsPerTable: number): number {
  return left.filter(r => r === seatsPerTable).length
}

// null when no warning applies at all: too small a party, a party bigger than
// one table (those are always seated by hand), or no table layout set yet.
export function partyFit(
  existingPartySizes: number[],
  party: number,
  tableCount: number | null,
  seatsPerTable: number | null,
): SeatingFit | null {
  if (!tableCount || !seatsPerTable) return null
  if (party < WARN_FROM_PARTY_SIZE || party > seatsPerTable) return null
  const left = seatsLeftPerTable(existingPartySizes, tableCount, seatsPerTable)
  const tablesThatFit = left.filter(r => r >= party).length
  if (tablesThatFit === 0) return 'nofit'
  if (tablesThatFit <= TIGHT_AT_OR_BELOW) return 'tight'
  return 'ok'
}
