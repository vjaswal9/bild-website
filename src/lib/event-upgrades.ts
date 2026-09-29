// Server-only. Collecting the extra cost when someone's ticket is changed to
// a more expensive package after they have already paid.
//
// Stripe cannot charge more to a card that was only authorised for the
// original checkout, so this issues a fresh, token-gated payment link on
// BILD's own site instead - the same pattern the business directory's
// listing-payment link already uses. The registration's own upgrade_due_aed
// is the source of truth for "is anything still owed"; the token just gates
// who is allowed to pay it.
import { randomUUID } from 'crypto'
import { supabaseAdmin } from './supabase-admin'
import { sendTicketUpgradePaymentEmail } from './email'

const EXPIRY_DAYS = 7
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'

export async function issueUpgradePaymentLink(opts: {
  registrationId: string
  amountAed: number
  note?: string
  eventTitle: string
  ticketName?: string | null
  to: string
  firstName?: string
}): Promise<{ ok: true; payUrl: string } | { ok: false; error: string }> {
  const token = randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('event_registrations')
    .update({
      upgrade_due_aed: opts.amountAed,
      upgrade_payment_token: token,
      upgrade_payment_token_expires_at: expiresAt,
      upgrade_note: opts.note || null,
    })
    .eq('id', opts.registrationId)

  if (error) return { ok: false, error: error.message }

  const payUrl = `${SITE_URL}/events/upgrade/${token}`
  await sendTicketUpgradePaymentEmail({
    to: opts.to,
    firstName: opts.firstName,
    eventTitle: opts.eventTitle,
    ticketName: opts.ticketName,
    amountAed: opts.amountAed,
    payUrl,
  })
  return { ok: true, payUrl }
}
