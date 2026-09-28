// Server-only. Table-seating group codes.
//
// A code is how a group of separately-bought tickets ends up at one table
// without anyone matching names or reconciling one-sided "sit with" wishes.
// Whoever books first gets a fresh code; everyone else in their group enters
// it when they book. The registrations that share a code are, by definition,
// the party admin will try to seat together.
import { supabaseAdmin } from './supabase-admin'

// Unambiguous on purpose: no 0/O, 1/I/L, since this gets read aloud or typed
// from a phone screen at a table full of people. Five characters is enough
// entropy that nobody stumbles onto a stranger's code by chance, without being
// so long it is annoying to type - this is a seating nicety, not a security
// boundary, so there is no need to go further than that.
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY346789'

export function generateSeatingCode(): string {
  let out = ''
  for (let i = 0; i < 5; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return out
}

export function normalizeSeatingCode(v: unknown): string {
  return typeof v === 'string' ? v.trim().toUpperCase().slice(0, 12) : ''
}

/**
 * Does this code already belong to a booking on this event? Used both by the
 * live "check as you type" endpoint and, again, inside checkout itself -
 * never trust the client's word that a code it showed the buyer is genuine.
 *
 * Matches against any registration regardless of status. A code shared before
 * the first person's payment has cleared must still work for their friends;
 * the admin seating view only ever groups PAID bookings, so an organiser whose
 * own payment never completes simply leaves their friends as a smaller group,
 * which is the right outcome rather than a hard failure.
 */
export async function findSeatingGroupOrganiser(
  eventId: string,
  code: string,
): Promise<{ found: true; organiserFirstName: string } | { found: false }> {
  const normalized = normalizeSeatingCode(code)
  if (!normalized) return { found: false }
  const { data } = await supabaseAdmin
    .from('event_registrations')
    .select('first_name, created_at')
    .eq('event_id', eventId)
    .eq('seating_code', normalized)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data) return { found: false }
  return { found: true, organiserFirstName: data.first_name || 'a member' }
}
