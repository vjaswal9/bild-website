// Server-only: imports the service-role Supabase client. Never import this
// file from a client component (it would leak the secret key into the bundle).
import { cache } from 'react'
import { supabaseAdmin, supabaseRead } from './supabase-admin'
import type { EventRow, EventTicket, EventRegistration } from './events'
import { readWithRetry } from './db-retry'

// Read through the cacheable client: this is the public events list, shown
// identically to every visitor, and it feeds both the homepage and /events.
// getEventBySlug deliberately does NOT use it - that page shows remaining
// capacity at the moment somebody is about to book.
export async function getPublishedEvents(): Promise<EventRow[]> {
  const { data } = await supabaseRead
    .from('events')
    .select('*')
    .eq('status', 'published')
    .order('event_date', { ascending: true })
  return (data as EventRow[]) || []
}

export async function getAllEvents(): Promise<EventRow[]> {
  const { data } = await supabaseAdmin
    .from('events')
    .select('*')
    .order('event_date', { ascending: false })
  return (data as EventRow[]) || []
}

// Fields safe to expose publicly - deliberately excludes cost_price_aed,
// which must never reach a client component's props/HTML.
const PUBLIC_TICKET_FIELDS = 'id, event_id, name, description, price_aed, sort_order, active, is_child'

// Wrapped in React's cache() so the event page does not load everything twice.
//
// generateMetadata and the page body both call this, and because the reads go
// through the no-store client Next cannot dedupe them itself. Every visit to an
// event page was therefore running the same three queries twice: the event, its
// tickets, and the count of tickets sold. cache() makes the second call inside
// the same request return the first one's result, with no change in behaviour:
// it is per-request only, so the capacity figure is still read fresh on every
// visit, which is the whole reason this path avoids the cached client.
export const getEventBySlug = cache(async function getEventBySlug(
  slug: string
): Promise<{ event: EventRow; tickets: EventTicket[]; remaining: number | null } | null> {
  const { data, error } = await readWithRetry(`event page: load ${slug}`, () =>
    supabaseAdmin.from('events').select('*').eq('slug', slug).maybeSingle(),
  )
  // A failed read is not a missing event. Returning null here showed a 404 for
  // a live event whenever the database read failed. Throwing shows the
  // "could not load this event" page instead, which tells the visitor to try
  // again rather than that the event has gone.
  if (error) throw new Error(`Could not load event ${slug}`)
  if (!data) return null
  const event = data as EventRow
  const { data: tickets, error: ticketsError } = await readWithRetry(`event page: tickets for ${slug}`, () =>
    supabaseAdmin
      .from('event_tickets')
      .select(PUBLIC_TICKET_FIELDS)
      .eq('event_id', event.id)
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  )
  // Otherwise a failed read shows "Registration for this event isn't open yet".
  if (ticketsError) throw new Error(`Could not load tickets for ${slug}`)

  let remaining: number | null = null
  if (event.capacity_limit != null) {
    const { data: soldRows, error: soldError } = await readWithRetry(`event page: sold count for ${slug}`, () =>
      supabaseAdmin
        .from('event_registrations')
        .select('quantity')
        .eq('event_id', event.id)
        .eq('status', 'paid'),
    )
    if (soldError) throw new Error(`Could not count tickets for ${slug}`)
    const soldQty = (soldRows || []).reduce((s, r) => s + (Number(r.quantity) || 1), 0)
    remaining = Math.max(0, event.capacity_limit - soldQty)
  }

  return { event, tickets: (tickets as EventTicket[]) || [], remaining }
})

// Admin-only - includes cost_price_aed. Never call from a path that renders
// to a public visitor.
export async function getEventTickets(eventId: string): Promise<EventTicket[]> {
  const { data } = await supabaseAdmin
    .from('event_tickets')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
  return (data as EventTicket[]) || []
}

export async function getEventRegistrations(eventId: string): Promise<EventRegistration[]> {
  const { data } = await supabaseAdmin
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  return (data as EventRegistration[]) || []
}
