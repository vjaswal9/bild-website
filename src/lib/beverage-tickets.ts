// Tickets that include alcoholic drinks served by the venue.
//
// BILD does not sell or serve alcohol: the licensed venue does. A ticket that
// comes with the venue's beverage package carries a notice at booking, an age
// confirmation, and a line in the confirmation email. Whether a ticket is such
// a package is read from its name and description, so there is nothing extra
// to switch on in the admin: call the ticket "... Beverages ..." (or mention
// alcohol) and the notices appear.

// Wording that says a ticket does NOT include alcohol is removed before
// looking, so "non-alcoholic" or "alcohol free" never trigger the notices.
const NOT_ALCOHOL = /non[\s-]?alcoholic|alcohol[\s-]?free|zero[\s-]?alcohol|no alcohol|without alcohol/gi
const BEVERAGE = /\b(beverages?|alcohol(?:ic)?)\b/i

export function isBeveragePackage(t: { name?: string | null; description?: string | null }): boolean {
  const text = `${t.name || ''} ${t.description || ''}`.replace(NOT_ALCOHOL, ' ')
  return BEVERAGE.test(text)
}

export const DRINKING_AGE = 21

export function venuePossessive(venue?: string | null): string {
  const v = (venue || '').trim()
  if (!v) return 'the venue’s'
  return /s$/i.test(v) ? `${v}’` : `${v}’s`
}
