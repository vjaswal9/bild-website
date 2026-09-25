import { getAllEvents } from '@/lib/events-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { EventRegistration } from '@/lib/events'
import EventsAdmin from './EventsAdmin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminEventsPage() {
  const events = await getAllEvents()

  const { data: tickets } = await supabaseAdmin
    .from('event_tickets')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: regs } = await supabaseAdmin
    .from('event_registrations')
    .select('*')
    .order('created_at', { ascending: false })

  // Per event: bookings + total ticket count (sum of quantity, paid only).
  const regStats: Record<string, { total: number; paid: number; tickets: number; refunded: number }> = {}
  const registrationsByEvent: Record<string, EventRegistration[]> = {}
  ;(regs as EventRegistration[] || []).forEach(r => {
    const s = regStats[r.event_id] || { total: 0, paid: 0, tickets: 0, refunded: 0 }
    const qty = r.quantity ?? 1
    s.total += 1
    if (r.status === 'paid') { s.paid += 1; s.tickets += qty }
    if (r.status === 'refunded') s.refunded += 1
    regStats[r.event_id] = s
    ;(registrationsByEvent[r.event_id] ||= []).push(r)
  })

  return <EventsAdmin events={events} tickets={tickets || []} regStats={regStats} registrationsByEvent={registrationsByEvent} />
}
