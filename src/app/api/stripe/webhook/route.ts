import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { randomUUID } from 'crypto'
import { sendWelcomeEmail, sendEventConfirmation, sendTicketSaleAlert, sendNewMemberAlert, sendListingPaidConfirmation, sendFeaturedPaidConfirmation, sendOversoldRefundEmail, sendOversoldAdminAlert, sendLedgerWriteFailedAlert, sendExternalRefundAlert } from '@/lib/email'
import { readWithRetry } from '@/lib/db-retry'
import { googleReviewsLinkFor } from '@/lib/google-reviews-link'
import { loadRegistration, refundEverything } from '@/lib/event-refunds'
import { PaymentKind } from '@/lib/money'
import { LISTING_MEMBER_FEE_AED, LISTING_NON_MEMBER_FEE_AED, FEATURED_MEMBER_FEE_AED, FEATURED_NON_MEMBER_FEE_AED } from '@/lib/featured-copy'

type ExpandedCharge = {
  id?: string
  receipt_url?: string | null
  balance_transaction?: { fee?: number | null } | string | null
}

type ExpandedCheckoutSession = {
  payment_intent?: { latest_charge?: ExpandedCharge | string | null } | string | null
}

type ChargeDetails = {
  receiptUrl?: string
  chargeId?: string
  // What Stripe actually deducted, in AED. Taken from the balance
  // transaction rather than estimated, so international card and currency
  // conversion surcharges are included instead of assumed away.
  stripeFeeAed: number
}

// Best-effort fetch of the Stripe receipt URL and the real fee for a
// completed checkout. Never throws: a failure here must not block the DB
// update or the confirmation email.
async function getChargeDetails(sessionId: string): Promise<ChargeDetails> {
  try {
    const full = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge.balance_transaction'],
    }) as unknown as ExpandedCheckoutSession
    const pi = full.payment_intent
    if (!pi || typeof pi === 'string') return { stripeFeeAed: 0 }
    const charge = pi.latest_charge
    if (!charge || typeof charge === 'string') return { stripeFeeAed: 0 }
    const bt = charge.balance_transaction
    const feeMinor = bt && typeof bt !== 'string' ? (bt.fee ?? 0) : 0
    return {
      receiptUrl: charge.receipt_url ?? undefined,
      chargeId: charge.id ?? undefined,
      stripeFeeAed: Math.round(feeMinor) / 100,
    }
  } catch (e) {
    console.error('Could not fetch Stripe charge details:', e)
    return { stripeFeeAed: 0 }
  }
}

// Writes one row to the payment ledger. Everything the Money dashboard
// reports comes from this table, so it is recorded for every flow, but a
// failure here must never break the customer's payment: the ledger can
// always be rebuilt afterwards from Stripe via the backfill route.
async function recordPayment(row: {
  kind: PaymentKind
  description: string
  referenceId?: string | null
  eventId?: string | null
  grossAed: number
  revenueAed: number
  stripeSessionId: string
  charge: ChargeDetails
}) {
  // The database reports a failed write in its response rather than by
  // throwing, so the catch below never saw one. Two sales on 14 September went
  // unrecorded that way, silently. The write is now checked, retried once (it
  // is keyed on the Stripe session, so a retry cannot double count), and a
  // write that still fails emails the admins with how to repair it.
  try {
    const feePassedOn = Math.max(0, Math.round((row.grossAed - row.revenueAed) * 100) / 100)
    const { error } = await readWithRetry(`webhook: record ${row.kind} payment`, () => supabaseAdmin.from('payments').upsert({
      paid_at: new Date().toISOString(),
      kind: row.kind,
      description: row.description,
      reference_id: row.referenceId || null,
      event_id: row.eventId || null,
      gross_aed: row.grossAed,
      revenue_aed: row.revenueAed,
      fee_passed_on_aed: feePassedOn,
      stripe_fee_aed: row.charge.stripeFeeAed,
      currency: 'aed',
      stripe_session_id: row.stripeSessionId,
      stripe_charge_id: row.charge.chargeId || null,
      source: 'webhook',
    }, { onConflict: 'stripe_session_id' }))
    if (error) {
      const reason = (error as { message?: string }).message || String(error)
      console.error('Could not record payment in ledger:', reason)
      Sentry.captureException(new Error('Could not record a payment in the money ledger'), {
        tags: { flow: row.kind, checkout_session_id: row.stripeSessionId },
        contexts: { payment: { description: row.description, grossAed: row.grossAed, reason } },
      })
      await sendLedgerWriteFailedAlert({ description: row.description, grossAed: row.grossAed, stripeSessionId: row.stripeSessionId, reason })
    }
  } catch (e) {
    console.error('Could not record payment in ledger:', e)
  }
}

// The booking columns every ticket flow below reads.
const BOOKING_COLUMNS = 'email, first_name, last_name, ticket_name, amount_aed, event_id, quantity, guest_names, attendee_age'

type Booking = {
  email: string
  first_name: string
  last_name?: string | null
  ticket_name?: string | null
  amount_aed?: number | null
  event_id: string
  quantity?: number
  guest_names?: import('@/lib/events').GuestEntry[]
  attendee_age?: number | null
}

// Decides what a webhook delivery that marked zero rows paid actually means.
//
// The status filter on the update is what makes a repeat delivery harmless,
// but it is spent the moment the booking is marked paid, and the ledger row is
// not written until several steps later. A delivery that died in between (a
// function timeout, a cold-start blip, a throw on the event read) leaves the
// booking paid and unrecorded, and Stripe's retry then matches zero rows and
// returns 200 having sent no confirmation and recorded no money. That is the
// shape of the two sales lost on 14 September.
//
// So zero rows is not proof the work was done. Ask the ledger instead. A
// payment row for this session means it genuinely was a duplicate delivery and
// there is nothing to do. No row means the earlier attempt died half way, and
// the booking is handed back so the rest of the flow can finish it. The ledger
// write is keyed on the session, so a true duplicate can never double count.
async function bookingNeedingRecovery(
  regId: string,
  sessionId: string,
): Promise<Booking | 'retry' | null> {
  const { data: alreadyRecorded, error: ledgerError } = await readWithRetry(
    'webhook: check ledger before recovering a booking',
    () => supabaseAdmin.from('payments').select('id').eq('stripe_session_id', sessionId).maybeSingle(),
  )
  // Never guess here. If the ledger cannot be read, ask Stripe to deliver
  // again rather than risk a second confirmation for a sale already recorded.
  if (ledgerError) {
    console.error('Could not check the ledger before recovering a booking:', ledgerError)
    return 'retry'
  }
  if (alreadyRecorded) return null

  const { data, error } = await readWithRetry(
    'webhook: re-read a booking for recovery',
    () => supabaseAdmin
      .from('event_registrations')
      .select(`${BOOKING_COLUMNS}, status, stripe_session_id`)
      .eq('id', regId)
      .maybeSingle(),
  )
  if (error) {
    console.error('Could not re-read a booking for recovery:', error)
    return 'retry'
  }
  const row = data as (Booking & { status?: string; stripe_session_id?: string | null }) | null
  // Only recover a booking this very session paid for. Anything else is not
  // ours to finish.
  if (!row || row.status !== 'paid' || row.stripe_session_id !== sessionId) return null
  console.error('Recovering a paid booking that was never recorded:', { regId, sessionId })
  return row
}

// Stripe needs the raw body to verify the signature.
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') || ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET || ''

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'bad signature'
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      id: string
      client_reference_id?: string | null
      customer_email?: string | null
      amount_total?: number | null
      metadata?: Record<string, string> | null
    }

    // Event ticket purchases carry metadata.type === 'event'.
    if (session.metadata?.type === 'event') {
      const regId = session.metadata.registration_id
      if (regId) {
        // The status filter makes this idempotent: a retried webhook delivery
        // for an already-paid registration updates zero rows and sends no emails.
        const { data: rows, error: markPaidError } = await supabaseAdmin
          .from('event_registrations')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_session_id: session.id,
            // amount_aed keeps the ticket revenue set at checkout (the card fee
            // is a pass-through to Stripe, not event income).
          })
          .eq('id', regId)
          .eq('status', 'pending')
          .select(BOOKING_COLUMNS)
        // If the booking could not be marked paid, say so to Stripe. It then
        // sends this notification again, for up to three days, rather than the
        // money being accepted for a booking that still reads as unpaid and is
        // missing from the door list. Nothing else has happened yet, so a
        // repeat is safe.
        if (markPaidError) {
          console.error('Could not mark event booking paid, asking Stripe to retry:', markPaidError)
          // Somebody has paid and their booking does not say so. Nothing on
          // this site matters more than this line.
          Sentry.captureException(new Error('Could not mark an event booking paid'), {
            level: 'fatal',
            tags: { flow: 'event_ticket', checkout_session_id: session.id, registration_id: regId },
            contexts: { supabase: { message: (markPaidError as { message?: string }).message ?? String(markPaidError) } },
          })
          return NextResponse.json({ error: 'Could not record the booking, please retry.' }, { status: 500 })
        }
        let reg = rows?.[0] as Booking | undefined
        if (!reg) {
          const recovery = await bookingNeedingRecovery(regId, session.id)
          if (recovery === 'retry') {
            return NextResponse.json({ error: 'Could not check the booking, please retry.' }, { status: 500 })
          }
          reg = recovery ?? undefined
        }
        if (reg) {
          const { data: ev } = await supabaseAdmin
            .from('events')
            .select('title, slug, event_date, end_date, venue, google_maps_url, capacity_limit')
            .eq('id', reg.event_id)
            .maybeSingle()
          const eventTitle = (ev as { title?: string })?.title || 'BILD Event'
          const guests = ((reg as { guest_names?: import('@/lib/events').GuestEntry[] }).guest_names) || []
          const quantity = (reg as { quantity?: number }).quantity ?? 1
          const charge = await getChargeDetails(session.id)
          const receiptUrl = charge.receiptUrl
          // amount_aed is the ticket revenue; anything the buyer paid above
          // it is the card processing surcharge passed straight to Stripe.
          await recordPayment({
            kind: 'event_ticket',
            description: eventTitle,
            referenceId: regId,
            eventId: reg.event_id as string,
            grossAed: session.amount_total != null ? session.amount_total / 100 : (reg.amount_aed ?? 0),
            revenueAed: reg.amount_aed ?? 0,
            stripeSessionId: session.id,
            charge,
          })

          // Second capacity check, now that the money is in.
          //
          // The check at checkout counts bookings that have completed, so
          // several people paying at once can each be told there is room and
          // all go through. This is the only point where the true figure is
          // known. If this sale took the event past its cap, the money goes
          // straight back rather than BILD selling a seat that does not exist.
          const capacity = (ev as { capacity_limit?: number | null })?.capacity_limit ?? null
          if (capacity != null) {
            const thisQty = Number((reg as { quantity?: number }).quantity) || 1
            const { data: soldRows, error: capError } = await supabaseAdmin
              .from('event_registrations')
              .select('id, quantity')
              .eq('event_id', reg.event_id)
              .eq('status', 'paid')
            if (capError) {
              // Never refund on a failed read. Letting one sale through is
              // recoverable; refunding someone who was entitled to their
              // ticket is not.
              console.error('Could not re-check capacity after payment, letting the sale stand:', capError)
            } else {
              const soldBefore = (soldRows || [])
                .filter(r => r.id !== regId)
                .reduce((s, r) => s + (Number(r.quantity) || 1), 0)
              if (soldBefore + thisQty > capacity) {
                const buyerName = `${reg.first_name} ${reg.last_name ?? ''}`.trim()
                console.error('Sale broke the capacity cap, refunding', { regId, capacity, soldBefore, thisQty })
                Sentry.captureMessage('A sale broke the event capacity cap and is being refunded', {
                  level: 'warning',
                  tags: { flow: 'event_ticket', registration_id: regId, event_slug: (ev as { slug?: string })?.slug ?? 'unknown' },
                  contexts: { capacity: { capacity, soldBefore, thisQty } },
                })
                try {
                  // Inside the try on purpose: this read can throw, and a
                  // throw escaping here would leave an oversold customer
                  // unrefunded with nobody told.
                  const fresh = await loadRegistration(regId)
                  if (!fresh) throw new Error('The booking could not be re-read.')
                  const outcome = await refundEverything(
                    fresh,
                    `${eventTitle} reached its ${capacity} ticket cap while this payment was going through`,
                  )
                  await sendOversoldRefundEmail({
                    to: reg.email,
                    firstName: reg.first_name,
                    eventTitle,
                    refundedAed: outcome.refundedAed,
                    eventSlug: (ev as { slug?: string })?.slug,
                  })
                  await sendOversoldAdminAlert({
                    eventTitle, buyerName, buyerEmail: reg.email, quantity: thisQty,
                    capacity, alreadySold: soldBefore, refundedAed: outcome.refundedAed,
                  })
                } catch (e) {
                  // The refund failed, so somebody is holding tickets that do
                  // not exist and does not know it. That needs a person.
                  await sendOversoldAdminAlert({
                    eventTitle, buyerName, buyerEmail: reg.email, quantity: thisQty,
                    capacity, alreadySold: soldBefore,
                    failure: e instanceof Error ? e.message : 'Unknown error',
                  })
                }
                // Either way there is no confirmation to send: they are not
                // coming. The ledger entry above stays, with the refund
                // recorded against it, so the fee Stripe keeps on a refund
                // shows up as the real cost of the oversell.
                return NextResponse.json({ received: true, oversold: true })
              }
            }
          }
          await sendEventConfirmation({
            to: reg.email,
            firstName: reg.first_name,
            lastName: reg.last_name,
            eventTitle,
            ticketName: reg.ticket_name,
            eventDate: (ev as { event_date?: string })?.event_date || new Date().toISOString(),
            amountAed: reg.amount_aed ?? 0,
            totalPaidAed: session.amount_total != null ? session.amount_total / 100 : (reg.amount_aed ?? 0),
            receiptUrl,
            quantity,
            guests,
            attendeeAge: reg.attendee_age,
            venue: (ev as { venue?: string })?.venue,
            googleMapsUrl: (ev as { google_maps_url?: string })?.google_maps_url,
            eventSlug: (ev as { slug?: string })?.slug,
            eventEndDate: (ev as { end_date?: string | null })?.end_date,
          })
          // Alert the admin that a ticket was sold.
          //
          // The error was previously discarded, so a failed count silently
          // became zero and the alert claimed "Total tickets sold: 0" on an
          // event that had sold 38. A wrong number is worse than no number,
          // so a failure now omits the line and says so in the log.
          const { data: soldRows, error: soldError } = await supabaseAdmin
            .from('event_registrations')
            .select('quantity')
            .eq('event_id', reg.event_id)
            .eq('status', 'paid')

          let totalTicketsSold: number | undefined
          if (soldError) {
            console.error('Could not count tickets sold for the sale alert:', soldError)
          } else {
            totalTicketsSold = (soldRows || []).reduce((s, r) => s + (Number(r.quantity) || 1), 0)
            // The running total can never be smaller than the sale that just
            // happened. If it is, the read is wrong, so report nothing.
            if (totalTicketsSold < quantity) {
              console.error('Ticket count came back below this sale, omitting it', { totalTicketsSold, quantity })
              totalTicketsSold = undefined
            }
          }
          await sendTicketSaleAlert({
            eventTitle,
            buyerName: `${reg.first_name} ${reg.last_name ?? ''}`.trim(),
            buyerEmail: reg.email,
            ticketName: reg.ticket_name,
            quantity,
            amountAed: reg.amount_aed ?? 0,
            guests,
            totalTicketsSold,
          })
        }
      }
      return NextResponse.json({ received: true })
    }

    // Directory annual listing fee.
    if (session.metadata?.type === 'business_listing') {
      const businessId = session.metadata.business_id
      if (businessId) {
        const paidUntil = new Date()
        paidUntil.setFullYear(paidUntil.getFullYear() + 1)
        // The listing_paid_until filter (must not already be a future date)
        // makes this idempotent against retried webhook deliveries.
        const { data: rows, error: listingError } = await supabaseAdmin
          .from('business_submissions')
          .update({
            listing_paid_until: paidUntil.toISOString(),
            listing_payment_token: null,
            listing_payment_token_expires_at: null,
            listing_renewal_reminder_sent_at: null,
            listing_final_reminder_sent_at: null,
            listing_expired_notice_sent_at: null,
          })
          .eq('id', businessId)
          .or('listing_paid_until.is.null,listing_paid_until.lt.now()')
          .select('email, business_name, slug, is_bild_member, google_place_id')
        // A failed update here used to be discarded, so a business could pay
        // its listing fee and have nothing recorded, no email sent, and Stripe
        // told everything was fine. Asking for a retry is safe: the filter
        // above means a second delivery for a listing already paid changes
        // nothing.
        if (listingError) {
          console.error('Could not mark a directory listing paid, asking Stripe to retry:', listingError)
          Sentry.captureException(new Error('Could not mark a directory listing paid'), {
            level: 'fatal',
            tags: { flow: 'listing', checkout_session_id: session.id, business_id: businessId },
            contexts: { supabase: { message: (listingError as { message?: string }).message ?? String(listingError) } },
          })
          return NextResponse.json({ error: 'Could not record the listing payment, please retry.' }, { status: 500 })
        }
        const biz = rows?.[0]
        if (biz) {
          const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
          const base = process.env.NEXT_PUBLIC_SITE_URL || origin
          const charge = await getChargeDetails(session.id)
          const receiptUrl = charge.receiptUrl
          // No surcharge is added to directory fees, so BILD absorbs the
          // whole Stripe fee here: gross and revenue are the same figure.
          const listingAed = session.amount_total != null
            ? session.amount_total / 100
            : (biz.is_bild_member ? LISTING_MEMBER_FEE_AED : LISTING_NON_MEMBER_FEE_AED)
          await recordPayment({
            kind: 'listing',
            description: `Directory listing - ${biz.business_name}`,
            referenceId: businessId,
            grossAed: listingAed,
            revenueAed: listingAed,
            stripeSessionId: session.id,
            charge,
          })
          await sendListingPaidConfirmation({
            to: biz.email,
            businessName: biz.business_name,
            profileUrl: `${base}/directory/${biz.slug}`,
            receiptUrl,
            googleReviewsUrl: biz.google_place_id ? null : await googleReviewsLinkFor(businessId),
          })
        }
      }
      return NextResponse.json({ received: true })
    }

    // Featured quarterly upgrade.
    if (session.metadata?.type === 'business_featured') {
      const businessId = session.metadata.business_id
      if (businessId) {
        const paidUntil = new Date()
        paidUntil.setMonth(paidUntil.getMonth() + 3)
        const manageToken = randomUUID().replace(/-/g, '')
        // The featured_paid_until filter makes this idempotent against
        // retried deliveries, so a 500 below is safe to ask for.
        const { data: rows, error: featuredError } = await supabaseAdmin
          .from('business_submissions')
          .update({
            featured: true,
            featured_paid_until: paidUntil.toISOString(),
            featured_manage_token: manageToken,
            featured_renewal_reminder_sent_at: null,
            featured_final_reminder_sent_at: null,
            featured_expired_notice_sent_at: null,
          })
          .eq('id', businessId)
          .or('featured_paid_until.is.null,featured_paid_until.lt.now()')
          .select('email, business_name, is_bild_member')
        if (featuredError) {
          console.error('Could not mark a Featured upgrade paid, asking Stripe to retry:', featuredError)
          Sentry.captureException(new Error('Could not mark a Featured upgrade paid'), {
            level: 'fatal',
            tags: { flow: 'featured', checkout_session_id: session.id, business_id: businessId },
            contexts: { supabase: { message: (featuredError as { message?: string }).message ?? String(featuredError) } },
          })
          return NextResponse.json({ error: 'Could not record the Featured payment, please retry.' }, { status: 500 })
        }
        const biz = rows?.[0]
        if (biz) {
          const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
          const base = process.env.NEXT_PUBLIC_SITE_URL || origin
          const charge = await getChargeDetails(session.id)
          const receiptUrl = charge.receiptUrl
          const featuredAed = session.amount_total != null
            ? session.amount_total / 100
            : (biz.is_bild_member ? FEATURED_MEMBER_FEE_AED : FEATURED_NON_MEMBER_FEE_AED)
          await recordPayment({
            kind: 'featured',
            description: `Featured placement - ${biz.business_name}`,
            referenceId: businessId,
            grossAed: featuredAed,
            revenueAed: featuredAed,
            stripeSessionId: session.id,
            charge,
          })
          await sendFeaturedPaidConfirmation({
            to: biz.email,
            businessName: biz.business_name,
            manageUrl: `${base}/directory/manage/${manageToken}`,
            receiptUrl,
          })
        }
      }
      return NextResponse.json({ received: true })
    }

    const memberId = session.client_reference_id

    const update = {
      status: 'paid',
      paid_at: new Date().toISOString(),
      amount: session.amount_total ?? 5000,
      stripe_session_id: session.id,
    }

    // The status filter makes this idempotent: a retried webhook delivery for
    // an already-paid member updates zero rows and sends no emails.
    const query = memberId
      ? supabaseAdmin.from('members').update(update).eq('id', memberId).eq('status', 'pending')
      : session.customer_email
        ? supabaseAdmin.from('members').update(update).eq('email', session.customer_email).eq('status', 'pending')
        : null

    if (query) {
      const { data: rows, error: memberError } = await query.select('email, full_name, invite_token, gender, details')
      // As above: a discarded error here meant somebody could pay to join and
      // never be recorded as a member, never get their welcome email and never
      // get their WhatsApp invite, with Stripe told the payment was handled.
      if (memberError) {
        console.error('Could not mark a membership paid, asking Stripe to retry:', memberError)
        Sentry.captureException(new Error('Could not mark a membership paid'), {
          level: 'fatal',
          tags: { flow: 'membership', checkout_session_id: session.id },
          contexts: { supabase: { message: (memberError as { message?: string }).message ?? String(memberError) } },
        })
        return NextResponse.json({ error: 'Could not record the membership payment, please retry.' }, { status: 500 })
      }
      const member = rows?.[0]
      if (member) {
        const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
        const base = process.env.NEXT_PUBLIC_SITE_URL || origin
        const details = (member.details as Record<string, string>) || {}
        const charge = await getChargeDetails(session.id)
        const receiptUrl = charge.receiptUrl
        // The membership fee carries no surcharge, so BILD absorbs the
        // whole Stripe fee on every 50 AED join.
        const membershipAed = session.amount_total != null ? session.amount_total / 100 : 50
        await recordPayment({
          kind: 'membership',
          description: `Membership - ${member.full_name}`,
          referenceId: memberId || null,
          grossAed: membershipAed,
          revenueAed: membershipAed,
          stripeSessionId: session.id,
          charge,
        })
        // Everyone who joined through the form gets the automated single-use
        // invite link; gender only decides which WhatsApp group that link
        // resolves to. sendWelcomeEmail falls back to a "we will add you by
        // hand" version when there is no token at all, which in practice means
        // a member row created outside the join form - all 42 paid members to
        // date have had one.
        //
        // (This comment previously said ladies got the no-link version and men
        // got the invite. That stopped being true and is corrected here.)
        await sendWelcomeEmail({
          to: member.email,
          name: member.full_name,
          gender: member.gender,
          inviteUrl: member.invite_token ? `${base}/j/${member.invite_token}` : undefined,
          amountAed: session.amount_total != null ? session.amount_total / 100 : undefined,
          receiptUrl,
        })
        // Alert the admin team that a new member joined.
        await sendNewMemberAlert({
          name: member.full_name,
          gender: member.gender,
          whatsappNumber: details.whatsappNumber,
          uaeMobile: details.uaeMobile,
          ukCity: details.ukCity,
          indiaCity: details.indiaCity,
          religion: details.religion,
          referrerName: details.referrerName,
          referrerMobile: details.referrerMobile,
        })
      }
    }
  }

  // A refund issued outside BILD's own screens, which in practice means
  // straight from the Stripe dashboard.
  //
  // Until now only the admin Refund button reached the database. A dashboard
  // refund left the booking reading as paid, so the person stayed on the door
  // list and went on holding a seat against the cap, and the Money dashboard
  // carried on counting the sale as income. There was no way back except
  // editing rows by hand.
  //
  // Stripe reports the absolute amount refunded on the charge, so writing that
  // figure is idempotent in itself: a repeat delivery, or a refund BILD's own
  // flow issued a moment earlier, just writes the same number again.
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as { id: string; amount_refunded?: number | null }
    const refundedAed = Math.round(charge.amount_refunded ?? 0) / 100

    const { data: pay, error: payError } = await readWithRetry(
      'webhook: find the payment behind a Stripe refund',
      () => supabaseAdmin
        .from('payments')
        .select('id, kind, description, reference_id, gross_aed, refunded_aed')
        .eq('stripe_charge_id', charge.id)
        .maybeSingle(),
    )
    if (payError) {
      console.error('Could not look up the payment behind a Stripe refund, asking for a retry:', payError)
      return NextResponse.json({ error: 'Could not record the refund, please retry.' }, { status: 500 })
    }
    if (!pay) {
      // Payments taken before the ledger recorded charge ids will not match,
      // so this is not proof of a problem, but somebody should look.
      console.error('A Stripe refund matched no recorded payment:', charge.id)
      await sendExternalRefundAlert({
        kind: 'refund', description: 'Unmatched Stripe refund', refundedAed,
        closedBooking: false, stripeChargeId: charge.id, unmatched: true,
      })
      return NextResponse.json({ received: true })
    }
    // Already in step, which is the normal case when BILD issued the refund
    // itself a second earlier. Nothing to do and nobody to tell.
    if (Math.abs((Number(pay.refunded_aed) || 0) - refundedAed) < 0.005) {
      return NextResponse.json({ received: true })
    }

    const { error: ledgerError } = await readWithRetry(
      'webhook: record a Stripe refund in the ledger',
      () => supabaseAdmin.from('payments').update({ refunded_aed: refundedAed }).eq('id', pay.id),
    )
    if (ledgerError) {
      console.error('Could not write a Stripe refund to the ledger, asking for a retry:', ledgerError)
      return NextResponse.json({ error: 'Could not record the refund, please retry.' }, { status: 500 })
    }

    // Once the money is fully back, the seat should be too.
    let closedBooking = false
    const grossAed = Number(pay.gross_aed) || 0
    if (pay.kind === 'event_ticket' && pay.reference_id && grossAed > 0 && refundedAed + 0.005 >= grossAed) {
      const fresh = await loadRegistration(pay.reference_id as string)
      if (fresh && fresh.status === 'paid') {
        const line = `${new Date().toLocaleDateString('en-GB')}: refunded ${refundedAed} AED in Stripe`
        const { error: closeError } = await supabaseAdmin
          .from('event_registrations')
          .update({
            status: 'refunded',
            refunded_at: new Date().toISOString(),
            refunded_amount_aed: Number(fresh.amount_aed) || 0,
            admin_note: [fresh.admin_note, line].filter(Boolean).join('\n'),
          })
          .eq('id', fresh.id)
          .eq('status', 'paid')
        if (closeError) {
          // The ledger is right and the money is back; only the door list is
          // stale. Worth saying out loud rather than failing the whole
          // delivery and re-refunding nothing.
          console.error('Refund recorded but the booking could not be closed:', closeError)
        } else {
          closedBooking = true
        }
      }
    }

    await sendExternalRefundAlert({
      kind: 'refund',
      description: (pay.description as string) || 'A BILD payment',
      refundedAed,
      grossAed: grossAed || undefined,
      closedBooking,
      stripeChargeId: charge.id,
    })
    return NextResponse.json({ received: true })
  }

  // A chargeback. Deliberately changes nothing: the bank has only frozen the
  // money, and it comes back if BILD wins. Closing the booking now would take
  // somebody off the door list over a dispute that may well be decided in
  // BILD's favour. It needs a person, and quickly, because Stripe's deadline
  // is unforgiving.
  if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object as { charge?: string | null; amount?: number | null }
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : ''
    const { data: pay } = await supabaseAdmin
      .from('payments')
      .select('description, gross_aed')
      .eq('stripe_charge_id', chargeId)
      .maybeSingle()
    await sendExternalRefundAlert({
      kind: 'dispute',
      description: (pay as { description?: string })?.description || 'Unmatched Stripe payment',
      refundedAed: Math.round(dispute.amount ?? 0) / 100,
      grossAed: pay ? Number((pay as { gross_aed?: number }).gross_aed) || undefined : undefined,
      closedBooking: false,
      stripeChargeId: chargeId,
      unmatched: !pay,
    })
    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}
