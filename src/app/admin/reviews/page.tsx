import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNav from '@/components/admin/AdminNav'
import ReviewRequestsAdmin, { type EventGroup } from './ReviewRequestsAdmin'
import { isPastEvent, type GuestEntry } from '@/lib/events'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// One booking is one email address, whatever its party size, so the unit
// this page works in is the booking - not the individual attendee - and each
// row shows who is on it so an admin recognises the booking rather than a
// bare email address.
export default async function AdminReviewsPage() {
  const { data: events } = await supabaseAdmin
    .from('events')
    .select('id, title, slug, venue, event_date, end_date, status')
    .order('event_date', { ascending: false })

  const eventIds = (events || []).map(e => e.id)
  type Reg = {
    id: string; event_id: string; first_name: string; last_name: string | null
    email: string; quantity: number | null; guest_names: GuestEntry[]; created_at: string
  }
  const regs: Reg[] = eventIds.length
    ? ((
        await supabaseAdmin
          .from('event_registrations')
          .select('id, event_id, first_name, last_name, email, quantity, guest_names, created_at')
          .in('event_id', eventIds)
          .eq('status', 'paid')
          .order('created_at', { ascending: true })
      ).data as Reg[]) || []
    : []

  // Already asked - by the paused automated cron, or by an admin using this
  // page before - so a booking already asked recently is flagged rather than
  // asked again without anyone noticing it was a repeat.
  const { data: asked } = eventIds.length
    ? await supabaseAdmin
        .from('event_review_requests')
        .select('event_id, email, sent_at')
        .in('event_id', eventIds)
    : { data: [] }
  const askedMap = new Map<string, string>() // `${eventId}|${email lowercased}` -> most recent sent_at
  for (const a of asked || []) {
    const key = `${a.event_id}|${a.email.toLowerCase()}`
    const existing = askedMap.get(key)
    if (!existing || a.sent_at > existing) askedMap.set(key, a.sent_at)
  }

  const regsByEvent = new Map<string, Reg[]>()
  for (const r of regs) {
    const list = regsByEvent.get(r.event_id)
    if (list) list.push(r)
    else regsByEvent.set(r.event_id, [r])
  }

  const groups: EventGroup[] = (events || [])
    .filter(e => (regsByEvent.get(e.id) || []).length > 0)
    .map(e => ({
      eventId: e.id,
      title: e.title,
      venue: e.venue,
      eventDate: e.event_date,
      isPast: isPastEvent(e),
      bookings: (regsByEvent.get(e.id) || []).map(r => {
        const guests = ((r.guest_names as GuestEntry[]) || []).filter(g => g?.name)
        return {
          registrationId: r.id,
          buyerName: `${r.first_name} ${r.last_name || ''}`.trim(),
          email: r.email,
          partySize: r.quantity || 1,
          guestNames: guests.map(g => g.name),
          lastAskedAt: askedMap.get(`${e.id}|${r.email.toLowerCase()}`) || null,
        }
      }),
    }))
    // Past events first, most recently finished at the top - the one an admin
    // is most likely to be following up on right now. Any upcoming event with
    // early bookings sits below, soonest first, since nobody has attended yet.
    .sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? -1 : 1
      const diff = +new Date(a.eventDate) - +new Date(b.eventDate)
      return a.isPast ? -diff : diff
    })

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Google Review Requests" />
      <ReviewRequestsAdmin groups={groups} />
    </div>
  )
}
