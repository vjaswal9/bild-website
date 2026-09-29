import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isPastEvent, GuestEntry, Dietary } from '@/lib/events'
import { cardFeeFils } from '@/lib/fees'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'
import { readWithRetry } from '@/lib/db-retry'
import { generateSeatingCode, normalizeSeatingCode, findSeatingGroupOrganiser, seatingPositionFor } from '@/lib/seating-code'

export const dynamic = 'force-dynamic'

type IncomingGuest = { name?: string; title?: string; ticketId?: string; dietary?: string; dietaryNote?: string; age?: unknown }

// Child tickets carry an age. Checked here as well as in the browser: the
// booking form is the only thing asking for it, and anything posting straight
// to this route would otherwise put a child on the door list with no age at
// all. Returns null for anything that is not a whole number in range.
const MAX_CHILD_AGE = 17
function normalizeAge(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (!Number.isInteger(n) || n < 0 || n > MAX_CHILD_AGE) return null
  return n
}
const ageRequired = () => NextResponse.json(
  { error: `Please give an age between 0 and ${MAX_CHILD_AGE} for every child ticket.` },
  { status: 400 },
)

function normalizeDietaryNote(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, 200) : ''
}

const DIETARY_OPTIONS = new Set(['', 'vegetarian', 'vegan', 'other'])
function normalizeDietary(v: unknown): Dietary {
  const s = typeof v === 'string' ? v : ''
  return (DIETARY_OPTIONS.has(s) ? s : '') as Dietary
}

// A fixed set, not free text: this ends up on a door list read out loud and
// printed on a confirmation email, so anything typed by a script rather than
// chosen from the three real options is simply dropped rather than stored.
const TITLE_OPTIONS = new Set(['Mr.', 'Mrs.', 'Miss'])
function normalizeTitle(v: unknown): string {
  return typeof v === 'string' && TITLE_OPTIONS.has(v) ? v : ''
}

// Returned when the database could not be read, after one retry. Deliberately
// not "Event not available": that told a buyer a live event had gone.
const tryAgain = () => NextResponse.json(
  { error: 'We could not load this event just now. Please try again in a moment.' },
  { status: 503 },
)

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`events-checkout:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 15 })) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
    }

    const { eventId, ticketId, firstName, lastName, title: buyerTitleRaw, email, phone, dietary, dietaryNote, age: buyerAgeRaw, guests: rawGuests, seatingCode: rawSeatingCode } = await req.json()

    if (!eventId || !ticketId || !firstName || !email) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    // Re-checked here, not just in the browser: a title is required for every
    // attendee (see TITLE_OPTIONS above), so an empty or invalid value must be
    // rejected rather than silently stored as no title at all.
    const buyerTitle = normalizeTitle(buyerTitleRaw)
    if (!buyerTitle) {
      return NextResponse.json({ error: 'Please choose a title (Mr./Mrs./Miss).' }, { status: 400 })
    }
    // Re-checked here, not just in the browser. A ticket confirmation that
    // cannot be delivered is worse than a rejected booking: the buyer has
    // paid and has nothing to show for it.
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please check your email address, it does not look valid.' }, { status: 400 })
    }
    const buyerEmail = normaliseEmail(email)

    // Guests beyond the ceiling are rejected, never trimmed. This used to
    // slice the list, so a basket over the limit reached Stripe quietly missing
    // its last few people, always the ones chosen last: the children.
    const MAX_GUESTS = 19
    const incomingGuests: IncomingGuest[] = Array.isArray(rawGuests) ? rawGuests : []
    if (incomingGuests.length > MAX_GUESTS) {
      return NextResponse.json({
        error: `We can take up to ${MAX_GUESTS + 1} people on one booking. Please book the rest separately, or email events@bild.ae and we will sort it out for you.`,
      }, { status: 400 })
    }
    if (incomingGuests.some(g => !g?.name || !String(g.name).trim())) {
      return NextResponse.json({ error: 'Please provide a name for each extra ticket.' }, { status: 400 })
    }
    if (incomingGuests.some(g => !normalizeTitle(g.title))) {
      return NextResponse.json({ error: 'Please choose a title (Mr./Mrs./Miss) for each extra ticket.' }, { status: 400 })
    }
    if (incomingGuests.some(g => !g?.ticketId)) {
      return NextResponse.json({ error: 'Please choose a ticket package for each guest.' }, { status: 400 })
    }

    // Validate the event is real, published and still upcoming.
    const { data: event, error: eventError } = await readWithRetry('checkout: load event', () =>
      supabaseAdmin
        .from('events')
        .select('id, slug, title, status, event_date, end_date, venue, google_maps_url, capacity_limit, seating_enabled, seats_per_table')
        .eq('id', eventId)
        .maybeSingle(),
    )
    if (eventError) return tryAgain()

    if (!event || event.status !== 'published') {
      return NextResponse.json({ error: 'Event not available.' }, { status: 404 })
    }
    if (isPastEvent(event)) {
      return NextResponse.json({ error: 'Registration for this event has closed.' }, { status: 400 })
    }

    // Load every active ticket for this event, keyed by id.
    const { data: ticketRows, error: ticketsError } = await readWithRetry('checkout: load tickets', () =>
      supabaseAdmin
        .from('event_tickets')
        .select('id, name, price_aed, active, event_id, is_child')
        .eq('event_id', eventId)
        .eq('active', true),
    )
    if (ticketsError) return tryAgain()
    const ticketMap = new Map((ticketRows || []).map(t => [t.id, t]))

    const buyerTicket = ticketMap.get(ticketId)
    if (!buyerTicket) {
      return NextResponse.json({ error: 'Ticket not available.' }, { status: 400 })
    }

    // Resolve each guest's chosen package.
    const guestEntries: GuestEntry[] = []
    for (const g of incomingGuests) {
      const t = ticketMap.get(g.ticketId!)
      if (!t) return NextResponse.json({ error: 'A selected guest ticket is not available.' }, { status: 400 })
      const guestAge = t.is_child ? normalizeAge(g.age) : null
      if (t.is_child && guestAge == null) return ageRequired()
      const guestTitle = normalizeTitle(g.title)
      guestEntries.push({
        name: String(g.name).trim(),
        ticket_name: t.name,
        price_aed: t.price_aed,
        dietary: normalizeDietary(g.dietary),
        dietary_note: normalizeDietaryNote(g.dietaryNote),
        ...(guestAge != null ? { age: guestAge } : {}),
        ...(guestTitle ? { title: guestTitle } : {}),
      })
    }

    // The lead booker can be on a child ticket too: a parent booking two
    // children and not attending themselves puts a child first in the list.
    const buyerAge = buyerTicket.is_child ? normalizeAge(buyerAgeRaw) : null
    if (buyerTicket.is_child && buyerAge == null) return ageRequired()

    const qty = 1 + guestEntries.length
    const totalAed = buyerTicket.price_aed + guestEntries.reduce((s, g) => s + (g.price_aed || 0), 0)

    // Enforce the event's overall ticket cap, if one is set.
    if (event.capacity_limit != null) {
      // A failed count must not read as zero sold, which would wave through
      // a booking on a full event.
      const { data: soldRows, error: soldReadError } = await readWithRetry('checkout: count sold', () =>
        supabaseAdmin
          .from('event_registrations')
          .select('quantity')
          .eq('event_id', eventId)
          .eq('status', 'paid'),
      )
      if (soldReadError) return tryAgain()
      const soldQty = (soldRows || []).reduce((s, r) => s + (Number(r.quantity) || 1), 0)
      const remaining = event.capacity_limit - soldQty
      if (qty > remaining) {
        return NextResponse.json({
          // Deliberately does not name how many are left: the count is not
          // shown anywhere public, and an error message is not the place to
          // start.
          error: remaining <= 0
            ? 'Sorry, this event is sold out.'
            : 'Sorry, there are not enough tickets left for that many. Please try a smaller number.',
        }, { status: 400 })
      }
    }

    // Table seating. A fresh code for whoever books first in a group; anyone
    // who enters a friend's code is re-validated here rather than trusting
    // whatever the browser's live check said moments earlier. An event with
    // seating switched off never touches this at all, so a booking on a
    // regular event carries no code.
    let seatingCode: string | null = null
    if (event.seating_enabled) {
      const entered = normalizeSeatingCode(rawSeatingCode)
      if (entered) {
        const check = await findSeatingGroupOrganiser(eventId, entered)
        if (!check.found) {
          return NextResponse.json({
            error: 'We could not find that table code for this event. Check it with your friend, or leave it blank to get your own.',
          }, { status: 400 })
        }
        // A code is capped at one table's worth of seats. Someone joining a
        // code that is already full (or would overflow with this booking's
        // own party) is not turned away - they just start a fresh table of
        // their own instead, silently, the same as if they had left the box
        // blank. Only enforced once an admin has actually set a table size.
        const seatsPerTable = event.seats_per_table as number | null
        seatingCode = seatsPerTable != null && check.headcount + qty > seatsPerTable
          ? generateSeatingCode()
          : entered
      } else {
        seatingCode = generateSeatingCode()
      }
    }

    // Record the registration up front (pending until payment confirms).
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('event_registrations')
      .insert([{
        event_id: eventId,
        ticket_id: buyerTicket.id,
        ticket_name: buyerTicket.name,
        first_name: firstName,
        last_name: lastName || '',
        title: buyerTitle,
        email: buyerEmail,
        phone: phone || null,
        quantity: qty,
        guest_names: guestEntries,
        amount_aed: totalAed,
        status: 'pending',
        dietary: normalizeDietary(dietary),
        dietary_note: normalizeDietaryNote(dietaryNote),
        attendee_age: buyerAge,
        seating_code: seatingCode,
      }])
      .select('id, created_at')
      .single()

    if (regErr || !reg) {
      return NextResponse.json({ error: regErr?.message || 'Could not save registration.' }, { status: 500 })
    }

    const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`

    // Everything free - skip Stripe entirely.
    if (totalAed === 0) {
      await supabaseAdmin
        .from('event_registrations')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', reg.id)
      const { sendEventConfirmation, sendTicketSaleAlert } = await import('@/lib/email')
      const seatingPosition = event.seating_enabled && seatingCode
        ? await seatingPositionFor(eventId, seatingCode, reg.created_at, qty, event.seats_per_table)
        : null
      await sendEventConfirmation({
        to: buyerEmail,
        firstName,
        lastName,
        title: buyerTitle,
        eventTitle: event.title,
        ticketName: buyerTicket.name,
        eventDate: event.event_date,
        amountAed: 0,
        quantity: qty,
        guests: guestEntries,
        attendeeAge: buyerAge,
        venue: event.venue,
        googleMapsUrl: event.google_maps_url,
        eventSlug: event.slug,
        eventEndDate: event.end_date,
        seatingEnabled: event.seating_enabled,
        seatingCode,
        seatingPosition,
      })
      // Same guard as the paid path: a failed count must not be reported as
      // zero on an event that has sold plenty.
      const { data: soldRows, error: soldError } = await supabaseAdmin
        .from('event_registrations')
        .select('quantity')
        .eq('event_id', eventId)
        .eq('status', 'paid')
      let totalTicketsSold: number | undefined
      if (soldError) {
        console.error('Could not count tickets sold for the sale alert:', soldError)
      } else {
        totalTicketsSold = (soldRows || []).reduce((s, r) => s + (Number(r.quantity) || 1), 0)
        if (totalTicketsSold < qty) {
          console.error('Ticket count came back below this sale, omitting it', { totalTicketsSold, qty })
          totalTicketsSold = undefined
        }
      }
      await sendTicketSaleAlert({
        eventTitle: event.title,
        buyerName: `${firstName} ${lastName}`.trim(),
        buyerEmail,
        ticketName: buyerTicket.name,
        quantity: qty,
        amountAed: 0,
        guests: guestEntries,
        totalTicketsSold,
      })
      return NextResponse.json({ url: `${origin}/events/success?free=${reg.id}` })
    }

    // Build Stripe line items - one line per distinct package, quantity = count.
    const counts = new Map<string, { name: string; price: number; qty: number }>()
    const tally = (t: { id: string; name: string; price_aed: number }) => {
      const cur = counts.get(t.id) || { name: t.name, price: t.price_aed, qty: 0 }
      cur.qty += 1
      counts.set(t.id, cur)
    }
    tally(buyerTicket)
    for (const g of incomingGuests) {
      const t = ticketMap.get(g.ticketId!)!
      tally(t)
    }
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    Array.from(counts.values()).forEach(c => {
      if (c.price === 0) return // free packages don't need a paid line
      lineItems.push({
        price_data: {
          currency: 'aed',
          product_data: { name: `${event.title} - ${c.name}` },
          unit_amount: c.price * 100,
        },
        quantity: c.qty,
      })
    })

    // Pass the card-processing fee on to the buyer as its own line.
    const feeFils = cardFeeFils(totalAed)
    if (feeFils > 0) {
      lineItems.push({
        price_data: {
          currency: 'aed',
          product_data: { name: 'Card processing fee' },
          unit_amount: feeFils,
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: buyerEmail,
      client_reference_id: `event:${reg.id}`,
      metadata: {
        type: 'event',
        registration_id: reg.id,
        event_id: eventId,
        ticket_name: buyerTicket.name,
        quantity: String(qty),
        first_name: firstName,
        last_name: lastName,
      },
      success_url: `${origin}/events/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/events/${event.slug}`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    // Logged in full, but not returned. This message went straight to the
    // browser, which meant raw Postgres and Stripe errors (table names,
    // constraint names, internal ids) were being shown to whoever triggered
    // them, and were useless to that person anyway.
    console.error('Checkout failed:', e)
    Sentry.captureException(e, { tags: { flow: 'checkout' } })
    return NextResponse.json(
      { error: 'We could not book this event just now. Please try again in a moment.' },
      { status: 500 },
    )
  }
}
