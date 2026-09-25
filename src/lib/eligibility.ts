// The single source of truth for who can join BILD.
//
// This wording used to be retyped on the homepage, About, Join form, Terms and
// Community Rules, and had drifted apart: some pages said "born or raised in
// the UK" while others added "or previously settled", and some said "married
// to" while others said "spouses and partners". Those are different rules, not
// different phrasings. Everything now reads from here so the definition cannot
// diverge again. Change it in this file and it changes everywhere.

/** One sentence, for FAQs and short intros. */
export const ELIGIBILITY_SUMMARY =
  'BILD is open to individuals of Indian origin who were born, raised, or previously settled in the United Kingdom, ' +
  'who identify with both British and Indian culture, and who are currently residing in the UAE. Spouses and ' +
  'partners of someone who meets these criteria are also welcome.'

/** The criteria as a list, for the About page and anywhere a list reads better. */
export const ELIGIBILITY_CRITERIA = [
  'Individuals of Indian origin who were born, raised, or previously settled in the United Kingdom',
  'Those who identify with both British and Indian culture',
  'Spouses and partners of someone who meets the above criteria',
  'All faiths and backgrounds within the British Indian community',
]

/** Applies to every route above: members must be in the UAE. */
export const ELIGIBILITY_RESIDENCY = 'Members must currently be residing in the UAE.'

/** The declaration a person ticks on the join form. */
export const ELIGIBILITY_CONFIRMATION =
  'I confirm that I am of Indian origin and was born, raised, or previously settled in the United Kingdom, or that ' +
  'I am the spouse or partner of someone who is, and that I currently reside in the UAE.'

/** Short descriptor for headings and meta descriptions. */
export const ELIGIBILITY_SHORT = 'of British Indian heritage, or the spouse or partner of someone who is'
