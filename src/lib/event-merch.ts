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
//
// unitPriceAed lets the event's figures say how many were sold ("12 sold") rather
// than listing every 20 AED payment.
export const EVENT_MERCH: Record<string, { eventId: string; label: string; unitPriceAed: number }> = {
  // BILD Garba 2026, 17 October 2026: merchandise used at the event, 20 AED each.
  merch_garba2026: { eventId: '0cfc1774-f29a-431e-9e5f-546e7e755a0c', label: 'BILD Garba 2026 merchandise', unitPriceAed: 20 },
}

// Adds up an event's merchandise payments into one line per kind of item:
// how many were sold and the total, after refunds. Refunded items are not
// counted. A payment of 40 AED at 20 AED each is two items.
export function summariseMerchPayments(
  rows: { id: string; paid_at: string; description: string | null; revenue_aed: number | string | null; refunded_aed: number | string | null }[],
): { id: string; date: string; description: string; amountAed: number; sold: number | null; payments: number }[] {
  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = r.description || 'Merchandise'
    groups.set(key, [...(groups.get(key) || []), r])
  }
  return Array.from(groups.entries()).map(([label, list]) => {
    const amount = list.reduce((s, r) => s + (Number(r.revenue_aed) || 0) - (Number(r.refunded_aed) || 0), 0)
    const unit = Object.values(EVENT_MERCH).find(m => m.label === label)?.unitPriceAed
    const latest = list.reduce((m, r) => (r.paid_at > m ? r.paid_at : m), list[0].paid_at)
    return {
      id: `merch:${label}`,
      date: String(latest).slice(0, 10),
      description: label,
      amountAed: Math.round(amount * 100) / 100,
      sold: unit ? Math.max(0, Math.floor(amount / unit + 0.0001)) : null,
      payments: list.length,
    }
  })
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
