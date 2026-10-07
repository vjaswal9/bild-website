import { cardFeeFils } from '@/lib/fees'
import type { PaymentKind } from '@/lib/money'

// Pure helpers for the "Import history from Stripe" tool, kept apart from the
// route so they can be tested without Stripe.

// What a Stripe checkout was for, from the metadata this site attaches to it.
// A ticket UPGRADE is event income like the ticket it upgrades, and is
// recorded that way by the live webhook, so the import must do the same. It
// used to fall through to "membership" and carry an id that is not a uuid.
export function classifyCheckout(metadata: Record<string, string> | null | undefined): PaymentKind {
  switch (metadata?.type) {
    case 'event':
    case 'event_upgrade': return 'event_ticket'
    case 'business_listing': return 'listing'
    case 'business_featured': return 'featured'
    default: return 'membership'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The ledger's reference columns are uuids. Anything else (for example the
// "event_upgrade:<uuid>" form Stripe's client_reference_id can carry) becomes
// null rather than failing the whole import: one odd row must not block the
// other hundreds.
export function asUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID.test(value) ? value : null
}

// An upgrade checkout charges the price difference plus the card surcharge. The
// difference (BILD's income) is recovered by finding the whole-dirham amount
// whose price plus surcharge equals what was charged. Falls back to the gross
// if nothing matches, which slightly overstates income, never loses a payment.
export function upgradeRevenueFromGross(grossAed: number): number {
  const grossFils = Math.round(grossAed * 100)
  for (let due = Math.floor(grossAed); due >= 1; due--) {
    if (due * 100 + cardFeeFils(due) === grossFils) return due
  }
  return grossAed
}
