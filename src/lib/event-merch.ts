// Merchandise (or anything else) sold at an event through a Stripe Payment Link
// and a printed QR code, instead of through the booking form.
//
// The link's address carries a short reference, for example
//   https://buy.stripe.com/xxxx?client_reference_id=merch_garba2026
// and Stripe hands that reference back on the payment. This list says which event
// each reference belongs to, so the sale is recorded in the Money ledger against
// that event and the card fee BILD absorbs shows in that event's figures.
//
// A reference only counts when the payment really came from a Payment Link, so
// the same text cannot be used to make a sale appear on an event from anywhere
// else.
export const EVENT_MERCH: Record<string, { eventId: string; label: string }> = {
  // BILD Garba 2026, 17 October 2026: merchandise used at the event, 20 AED each.
  merch_garba2026: { eventId: '0cfc1774-f29a-431e-9e5f-546e7e755a0c', label: 'BILD Garba 2026 merchandise' },
}

type SessionLike = {
  client_reference_id?: string | null
  payment_link?: string | { id?: string } | null
}

export function merchSaleFor(session: SessionLike): { eventId: string; label: string } | null {
  if (!session.payment_link) return null
  const ref = session.client_reference_id
  if (!ref) return null
  return Object.prototype.hasOwnProperty.call(EVENT_MERCH, ref) ? EVENT_MERCH[ref] : null
}
