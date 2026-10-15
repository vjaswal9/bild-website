import { stripe } from './stripe'

type ExpandedCharge = {
  id?: string
  receipt_url?: string | null
  balance_transaction?: { fee?: number | null } | string | null
}

type ExpandedCheckoutSession = {
  payment_intent?: { latest_charge?: ExpandedCharge | string | null } | string | null
}

export type ChargeDetails = {
  receiptUrl?: string
  chargeId?: string
  // What Stripe actually deducted, in AED. Taken from the balance
  // transaction rather than estimated, so international card and currency
  // conversion surcharges are included instead of assumed away.
  stripeFeeAed: number
}

type Deps = {
  retrieve?: (sessionId: string) => Promise<ExpandedCheckoutSession>
  wait?: (ms: number) => Promise<void>
}

const defaultRetrieve = (sessionId: string) =>
  stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge.balance_transaction'],
  }) as unknown as Promise<ExpandedCheckoutSession>

const defaultWait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// How long to wait before looking again for a fee Stripe had not worked out yet.
const FEE_RETRY_MS = 2500

// Best-effort fetch of the Stripe receipt URL and the real fee for a completed
// checkout. Never throws: a failure here must not block the DB update or the
// confirmation email.
//
// The fee is on the charge's balance transaction, and Stripe does not always
// have it ready in the moment the payment completes. About a third of the
// ledger's payments were recorded with a fee of 0 for that reason. When the
// charge is there but the fee is not, this waits a moment and looks once more.
export async function getChargeDetails(sessionId: string, deps: Deps = {}): Promise<ChargeDetails> {
  const retrieve = deps.retrieve || defaultRetrieve
  const wait = deps.wait || defaultWait
  let details: ChargeDetails = { stripeFeeAed: 0 }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const full = await retrieve(sessionId)
      const pi = full.payment_intent
      if (!pi || typeof pi === 'string') return details
      const charge = pi.latest_charge
      if (!charge || typeof charge === 'string') return details
      const bt = charge.balance_transaction
      const feeMinor = bt && typeof bt !== 'string' ? (bt.fee ?? 0) : 0
      details = {
        receiptUrl: charge.receipt_url ?? undefined,
        chargeId: charge.id ?? undefined,
        stripeFeeAed: Math.round(feeMinor) / 100,
      }
      if (details.stripeFeeAed > 0) return details
    } catch (e) {
      console.error('Could not fetch Stripe charge details:', e)
      return details
    }
    if (attempt === 1) await wait(FEE_RETRY_MS)
  }
  return details
}
