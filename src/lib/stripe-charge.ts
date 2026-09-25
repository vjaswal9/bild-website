import { stripe } from './stripe'

// What a booking's buyer was actually charged, and where their receipt is.
//
// The payment webhook has both to hand when it sends the original ticket
// confirmation, so that email shows tickets, card fee and total paid, and links
// the Stripe receipt. A confirmation resent later from the admin had neither,
// so it fell back to a single "390 AED paid" line and left the receipt row out
// entirely. To a member that reads as though the card fee was never charged.
//
// Never throws. A confirmation missing its total is still worth sending; one
// that fails to send is not.
export async function getPaymentSummary(sessionId?: string | null): Promise<{
  totalPaidAed?: number
  receiptUrl?: string
}> {
  if (!sessionId) return {}
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    })
    const totalPaidAed = session.amount_total != null ? session.amount_total / 100 : undefined
    const pi = session.payment_intent
    const charge = pi && typeof pi !== 'string' ? pi.latest_charge : null
    const receiptUrl = charge && typeof charge !== 'string' ? charge.receipt_url ?? undefined : undefined
    return { totalPaidAed, receiptUrl }
  } catch (e) {
    console.error('Could not read the Stripe payment for a booking:', e)
    return {}
  }
}
