import { cardFeeFils, cardFeeFilsAt, LEGACY_CARD_FEE } from '@/lib/fees'
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
    // Today's surcharge, or the one in force before it was raised.
    if (due * 100 + cardFeeFils(due) === grossFils) return due
    if (due * 100 + cardFeeFilsAt(due, LEGACY_CARD_FEE.percent, LEGACY_CARD_FEE.fixedAed) === grossFils) return due
  }
  return grossAed
}

// What a ledger row that already exists should be corrected to, given what
// Stripe now says about the same payment. Deliberately narrow: only figures that
// legitimately change or only become known after the payment was first recorded.
//
//  - refunded_aed: a refund issued later.
//  - stripe_charge_id: where one was never recorded.
//  - stripe_fee_aed: the webhook records a payment the instant it completes, and
//    Stripe does not always have the fee ready by then, so it stored 0. A real fee
//    is only ever filled in over a 0; a fee already on the row is never changed.
//
// Everything else on the row (description, revenue split, any manual correction)
// is left exactly as it is.
export function repairPatch(
  row: { refunded_aed?: number | string | null; stripe_charge_id?: string | null; stripe_fee_aed?: number | string | null },
  fresh: { refunded_aed: number; stripe_charge_id: string | null; stripe_fee_aed: number },
): Record<string, number | string> {
  const patch: Record<string, number | string> = {}
  if (Math.abs((Number(row.refunded_aed) || 0) - fresh.refunded_aed) >= 0.005) {
    patch.refunded_aed = fresh.refunded_aed
  }
  if (!row.stripe_charge_id && fresh.stripe_charge_id) {
    patch.stripe_charge_id = fresh.stripe_charge_id
  }
  if ((Number(row.stripe_fee_aed) || 0) < 0.005 && fresh.stripe_fee_aed >= 0.005) {
    patch.stripe_fee_aed = fresh.stripe_fee_aed
  }
  return patch
}
