import { supabaseAdmin } from './supabase-admin'
import { stripe } from './stripe'
import { sendRefundConfirmation, sendLedgerWriteFailedAlert } from './email'
import { readWithRetry } from './db-retry'

// One place that knows how to give money back on an event booking, used both
// by the Refund action and by a ticket downgrade, so the two can never drift
// apart in how they treat Stripe, the booking status or the ledger.

export type RefundOutcome = {
  refundedAed: number
  totalRefundedAed: number
  isFull: boolean
  stripeRefundId: string | null
  // Whether the customer's refund confirmation actually went out. The money
  // moving and the email arriving are separate facts, and the admin should
  // not be told the second happened when only the first did.
  emailed: boolean
  emailError?: string
  // The money went back and the booking was updated, but the Money dashboard
  // could not be told. Separate from the refund succeeding, and the admin
  // needs to know which of the two happened.
  ledgerError?: string
}

type Registration = {
  id: string
  status: string
  amount_aed: number
  refunded_amount_aed: number | null
  stripe_session_id: string | null
  admin_note: string | null
  email: string | null
  first_name: string | null
  last_name: string | null
  ticket_name: string | null
  event_id: string | null
}

export type RefundOptions = {
  amountAed: number
  note?: string
  // Closes the booking even when money has been kept back. Whether somebody
  // is still coming and whether they got all their money back are two
  // different questions: BILD normally keeps an admin fee when a member
  // cancels, and that person must still come off the door list.
  forceClose?: boolean
  // Shown on the customer's confirmation so the arithmetic is transparent.
  adminFeeAed?: number
}

// What Stripe says is still refundable on this booking, in AED.
//
// This deliberately asks Stripe rather than reading the booking's own amount.
// A ticket change rewrites that amount to the new, lower total, so using it as
// the ceiling would block the very refund the downgrade created: move someone
// from a 500 AED package to a 100 AED one and the 400 owed back would exceed a
// cap of 100. Stripe knows what was actually charged and what has already gone
// back, which is the only figure that is true in both cases.
async function stripeRefundable(sessionId: string): Promise<{
  refundableAed: number
  paymentIntentId: string | null
  chargedAed: number
  alreadyRefundedAed: number
} | null> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    })
    const pi = session.payment_intent
    if (!pi || typeof pi === 'string') return null
    const charge = pi.latest_charge
    if (!charge || typeof charge === 'string') return null
    const charged = (charge.amount ?? 0) / 100
    const refunded = (charge.amount_refunded ?? 0) / 100
    return {
      refundableAed: Math.round((charged - refunded) * 100) / 100,
      paymentIntentId: pi.id,
      chargedAed: charged,
      alreadyRefundedAed: refunded,
    }
  } catch (e) {
    console.error('Could not read the Stripe charge for a booking:', e)
    return null
  }
}

/**
 * Gives back everything Stripe still holds on a booking, card fee included,
 * and closes it.
 *
 * Used when the fault is BILD's rather than the customer's, which today means
 * an event that filled up while they were paying. In that situation they must
 * be left no worse off, so the processing fee they were charged goes back too
 * even though Stripe keeps its own cut of it.
 */
export async function refundEverything(reg: Registration, note: string): Promise<RefundOutcome> {
  if (!reg.stripe_session_id) throw new Error('This booking has no Stripe payment to refund.')
  const info = await stripeRefundable(reg.stripe_session_id)
  if (!info || !info.paymentIntentId) {
    throw new Error('Could not find the original Stripe payment for this booking.')
  }
  if (info.refundableAed <= 0) throw new Error('Stripe has already refunded this payment in full.')
  return refundRegistration(reg, { amountAed: info.refundableAed, note, forceClose: true })
}

// Throws if the booking cannot be read, rather than returning null.
//
// The error used to be discarded, so a database that was merely unreachable
// looked exactly like a booking that does not exist: the admin refund screen
// answered "Registration not found" for a booking sitting right there in the
// door list. A read that failed and a row that is absent are different facts
// and the caller has to be able to tell them apart.
export async function loadRegistration(id: string): Promise<Registration | null> {
  const { data, error } = await readWithRetry(
    'load a booking to refund',
    () => supabaseAdmin
      .from('event_registrations')
      .select('id, status, amount_aed, refunded_amount_aed, stripe_session_id, admin_note, first_name, last_name, email, ticket_name, event_id')
      .eq('id', id)
      .maybeSingle(),
  )
  if (error) {
    throw new Error('The booking could not be read just now. Please try again in a moment.')
  }
  return (data as Registration) || null
}

/**
 * Refunds `amountAed` on a booking and records it.
 *
 * Throws an Error with a message safe to show an admin. The caller decides
 * what to do about a failure; nothing is written to the booking unless the
 * Stripe refund has already succeeded, so a failure never leaves money and
 * record disagreeing.
 */
export async function refundRegistration(
  reg: Registration,
  options: RefundOptions,
): Promise<RefundOutcome> {
  const { amountAed, note, forceClose, adminFeeAed } = options
  const requested = Math.round(amountAed * 100) / 100
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error('Please enter an amount greater than zero.')
  }

  const alreadyRecorded = Number(reg.refunded_amount_aed) || 0
  const bookingValue = Number(reg.amount_aed) || 0

  let stripeRefundId: string | null = null
  let isFull: boolean
  // Kept in scope so the customer's email can quote what Stripe says the card
  // was charged, rather than a figure derived from the booking.
  let info: Awaited<ReturnType<typeof stripeRefundable>> = null

  if (bookingValue > 0 && reg.stripe_session_id) {
    info = await stripeRefundable(reg.stripe_session_id)
    if (!info || !info.paymentIntentId) {
      throw new Error('Could not find the original Stripe payment for this booking.')
    }
    if (requested > info.refundableAed) {
      throw new Error(
        info.refundableAed <= 0
          ? 'Stripe has already refunded this payment in full.'
          : `Stripe has only ${info.refundableAed} AED left to refund on this payment.`,
      )
    }
    try {
      const refund = await stripe.refunds.create({
        payment_intent: info.paymentIntentId,
        // Always explicit. Omitting the amount refunds the entire charge,
        // including the card processing fee the buyer paid at checkout.
        amount: Math.round(requested * 100),
      })
      stripeRefundId = refund.id
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Stripe refund failed'
      throw new Error(`Could not process the Stripe refund: ${msg}`)
    }
    // Fully refunded means Stripe has nothing left to give back, not that the
    // amount happened to match the booking's current value, which a ticket
    // change may have lowered.
    isFull = Math.round((info.alreadyRefundedAed + requested) * 100) / 100 >= info.chargedAed
  } else {
    // A free booking, or one with no Stripe payment behind it.
    if (requested > bookingValue - alreadyRecorded) {
      throw new Error(`Only ${Math.round((bookingValue - alreadyRecorded) * 100) / 100} AED is left to refund on this booking.`)
    }
    isFull = alreadyRecorded + requested >= bookingValue
  }

  const closes = isFull || forceClose === true
  const totalRefunded = Math.round((alreadyRecorded + requested) * 100) / 100
  const trimmed = typeof note === 'string' ? note.trim().slice(0, 300) : ''
  const line = `${new Date().toLocaleDateString('en-GB')}: refunded ${requested} AED${trimmed ? ` (${trimmed})` : ''}`
  const admin_note = [reg.admin_note, line].filter(Boolean).join('\n')

  const { error } = await readWithRetry(
    'record a refund against the booking',
    () => supabaseAdmin
      .from('event_registrations')
      .update({
        refunded_amount_aed: totalRefunded,
        admin_note,
        ...(closes ? { status: 'refunded', refunded_at: new Date().toISOString() } : {}),
      })
      .eq('id', reg.id),
  )

  if (error) {
    // The money has gone back. Say so plainly rather than letting the admin
    // assume nothing happened and refund a second time.
    throw new Error(
      `The Stripe refund of ${requested} AED succeeded, but the booking could not be updated: ${error.message}. Do not refund again.`,
    )
  }

  // Keep the Money dashboard honest.
  //
  // This was wrapped in a try/catch that could never fire: the database
  // reports a failed write in its response rather than by throwing. So a
  // refund could go out, the booking be closed, and the Money page carry on
  // counting the full sale as income, with nothing logged and the admin told
  // it all worked. The error is now read, retried and reported.
  let ledgerError: string | undefined
  if (reg.stripe_session_id) {
    const { error: payError } = await readWithRetry(
      'record a refund in the money ledger',
      () => supabaseAdmin
        .from('payments')
        .update({ refunded_aed: totalRefunded })
        .eq('stripe_session_id', reg.stripe_session_id as string),
    )
    if (payError) {
      ledgerError = (payError as { message?: string }).message || String(payError)
      console.error('Could not update the payment ledger after a refund:', ledgerError)
      await sendLedgerWriteFailedAlert({
        description: `Refund of ${requested} AED on ${reg.ticket_name || 'a booking'}`,
        grossAed: requested,
        stripeSessionId: reg.stripe_session_id,
        reason: ledgerError,
      })
    }
  }

  // Tell the customer, with the admin team copied in. Sent after the record is
  // written so the email can never describe a refund that was not recorded.
  let emailed = false
  let emailError: string | undefined
  if (reg.email) {
    const { data: ev } = await supabaseAdmin
      .from('events')
      .select('title')
      .eq('id', reg.event_id)
      .maybeSingle()
    const outcome = await sendRefundConfirmation({
      to: reg.email,
      firstName: reg.first_name || undefined,
      eventTitle: (ev as { title?: string })?.title || 'your BILD event',
      ticketName: reg.ticket_name,
      refundedAed: requested,
      adminFeeAed,
      totalRefundedAed: totalRefunded,
      originallyChargedAed: info?.chargedAed,
      previouslyRefundedAed: alreadyRecorded,
      stillAttending: !closes,
      reason: trimmed || undefined,
    })
    emailed = outcome.ok
    if (!outcome.ok) emailError = outcome.reason
  } else {
    emailError = 'No email address on this booking.'
  }

  return { refundedAed: requested, totalRefundedAed: totalRefunded, isFull: closes, stripeRefundId, emailed, emailError, ledgerError }
}
