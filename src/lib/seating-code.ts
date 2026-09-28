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
 * Matches against any registration regardless of status, for finding the
 * organiser: a code shared before the first person's payment has cleared must
 * still work for their friends. Headcount is PAID only, because it exists to
 * tell somebody about to pay how many seats are genuinely already spoken for -
 * counting a pending checkout that might never complete would overstate that.
 */
export async function findSeatingGroupOrganiser(
  eventId: string,
  code: string,
): Promise<
  | { found: true; organiserFirstName: string; headcount: number }
  | { found: false }
> {
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

  const { data: paid } = await supabaseAdmin
    .from('event_registrations')
    .select('quantity')
    .eq('event_id', eventId)
    .eq('seating_code', normalized)
    .eq('status', 'paid')
  const headcount = (paid || []).reduce((s, r) => s + (Number(r.quantity) || 1), 0)

  return { found: true, organiserFirstName: data.first_name || 'a member', headcount }
}
