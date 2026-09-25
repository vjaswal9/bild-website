// One email check, used by every form and re-checked on the server.
//
// The old check was `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, which asks only for "text,
// @, text, dot, text". That accepts `name@gmail..com`, and a member booked and
// paid for an event with exactly that address. The payment went through, the
// confirmation could not be delivered, and nobody found out until he said so.
//
// This is deliberately not an attempt at full RFC 5322. It rejects the
// mistakes people actually make when typing an address into a phone.

const LOCAL = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?'

// local(.local)*@label(.label)+.tld  where tld is at least two letters.
const PATTERN = new RegExp(
  `^${LOCAL}(?:\\.${LOCAL})*@(?:${LABEL}\\.)+[A-Za-z]{2,63}$`
)

/**
 * True when the address is one we can realistically deliver to.
 *
 * Rejects, among others:
 *   name@gmail..com     consecutive dots
 *   name@.gmail.com     leading dot in the domain
 *   name@gmail.com.     trailing dot
 *   .name@gmail.com     leading dot in the local part
 *   name@gmail          no top-level domain
 *   name@gmail.c        one-letter top-level domain
 *   name @gmail.com     spaces anywhere
 *   a@b@c.com           more than one @
 */
export function isValidEmail(value: string): boolean {
  const v = (value || '').trim()
  if (!v || v.length > 254) return false
  if (v.includes('..')) return false
  const at = v.indexOf('@')
  if (at < 1 || at !== v.lastIndexOf('@')) return false
  if (v.slice(0, at).length > 64) return false
  return PATTERN.test(v)
}

// Trimmed and lower-cased. Addresses are case-insensitive in the part that
// matters, and storing them consistently stops the same person appearing twice.
export function normaliseEmail(value: string): string {
  return (value || '').trim().toLowerCase()
}

/**
 * A short, specific reason the address was rejected, for showing under a field.
 * Returns null when the address is fine.
 */
export function emailProblem(value: string): string | null {
  const v = (value || '').trim()
  if (!v) return 'Please enter your email address.'
  if (v.includes(' ')) return 'An email address cannot contain spaces.'
  if (!v.includes('@')) return 'An email address needs an @ sign.'
  if (v.indexOf('@') !== v.lastIndexOf('@')) return 'An email address can only have one @ sign.'
  if (v.includes('..')) return 'There are two dots in a row. Did you mean a single dot?'
  if (v.endsWith('.')) return 'An email address cannot end with a dot.'
  const domain = v.slice(v.indexOf('@') + 1)
  if (!domain) return 'Please add what comes after the @ sign.'
  if (!domain.includes('.')) return 'The part after the @ sign needs a dot, for example gmail.com.'
  if (!isValidEmail(v)) return 'That does not look like a valid email address.'
  return null
}
