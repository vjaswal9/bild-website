// Client-safe events module: pure types + helpers only.
// IMPORTANT: do NOT import supabase-admin (or any server-only secret) here -
// this file is imported by client components, so anything it imports ends up
// in the browser bundle.

export type EventTicket = {
  id: string
  event_id: string
  name: string
  description?: string | null
  price_aed: number
  // Internal cost price - admin-only, never fetched on any public-facing
  // query path. Absent (undefined) wherever a public page loads tickets.
  cost_price_aed?: number | null
  sort_order: number
  active: boolean
  // When true, the booking form asks for each person's age on this ticket and
  // will not submit without it. Set per ticket by an admin.
  is_child?: boolean
  // A menu, drinks list or similar - shown as a "View menu" link next to the
  // ticket on the booking form, so a buyer can see what a package includes
  // before paying for it. Optional; most tickets have none.
  menu_image_url?: string | null
}

export type GalleryItem = { url: string; type: 'image' | 'video' | 'instagram' }

export type Dietary = '' | 'vegetarian' | 'vegan' | 'other'

// A named guest on an extra ticket, with the package they chose.
// A named guest on an extra ticket, with the package they chose. `age` is
// present only for a guest on a ticket marked as a child ticket.
export type GuestEntry = { name: string; title?: string; ticket_name?: string; price_aed?: number; dietary?: Dietary; dietary_note?: string; age?: number }

export type EventRow = {
  id: string
  created_at: string
  slug: string
  title: string
  description: string
  venue: string | null
  location: string | null
  google_maps_url: string | null
  flyer_url: string | null
  event_date: string
  end_date: string | null
  status: 'draft' | 'published'
  tags: string[] | null
  gallery: GalleryItem[] | null
  // Optional overall cap on tickets sold for this event. Null = unlimited.
  capacity_limit: number | null
  // Lets a sold-out event stop taking waitlist entries without unpublishing.
  waitlist_open?: boolean
  // Only ask attendees for dietary requirements when this event actually needs it.
  dietary_required: boolean
  // Table seating. Off for most events (a padel morning has no tables to
  // assign); on for a sit-down dinner or gala. table_count and seats_per_table
  // are only meaningful once this is true, and both stay null until an admin
  // sets them - there is no site-wide default table size.
  seating_enabled?: boolean
  table_count?: number | null
  seats_per_table?: number | null
  seating_locked_at?: string | null
}

export type EventRegistration = {
  id: string
  created_at: string
  event_id: string
  ticket_id: string | null
  ticket_name: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  quantity: number
  guest_names: GuestEntry[]
  amount_aed: number
  status: 'pending' | 'paid' | 'refunded'
  paid_at: string | null
  refunded_at?: string | null
  // Money given back while the booking stays live: a guest dropped out, or a
  // ticket was downgraded. A full refund sets status to 'refunded' instead.
  refunded_amount_aed?: number | null
  // Running audit trail of admin changes to this booking.
  admin_note?: string | null
  dietary?: Dietary | null
  dietary_note?: string | null
  // Only set when the lead booker is themselves on a child ticket. Every other
  // attendee's age lives in their guest_names entry.
  attendee_age?: number | null
  // Optional courtesy title (Mr./Mrs./Miss) for the lead booker. A guest's
  // title, if any, lives inside their own guest_names entry instead.
  title?: string | null
  // Table seating: the code that groups this booking with others sharing it,
  // and the table(s) an admin has placed the whole group at. A group too big
  // for one table can be given several - which seat within those tables is
  // left for the group to sort out themselves. Both null on an event with
  // seating_enabled off, or before an admin has run seating.
  seating_code?: string | null
  seating_table?: number[] | null
}

// An event is "past" once its end (or start, if no end) is behind us.
export function isPastEvent(e: { event_date: string; end_date?: string | null }): boolean {
  const ref = e.end_date || e.event_date
  return new Date(ref).getTime() < Date.now()
}
