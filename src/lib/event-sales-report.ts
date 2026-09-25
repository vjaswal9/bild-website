import { supabaseAdmin } from './supabase-admin'

// The numbers behind the daily ticket email.
//
// Revenue, costs and profit are worked out exactly as the Money dashboard
// works them out, so the email and the dashboard can never disagree:
//   revenue = ticket money in, less anything refunded
//   costs   = the cost price of every ticket sold, plus costs booked against
//             the event, plus whatever of the Stripe fee was not recovered
//             from the buyer
//   profit  = revenue less costs
// The one difference is that an event with no sales yet still appears here,
// at zero, because "nothing has sold" is the single most useful thing this
// email can tell you.

// How far ahead an event has to be before it stops being worth a daily email.
export const REPORT_WINDOW_DAYS = 28

export type EventSalesRow = {
  id: string
  title: string
  date: string
  daysAway: number
  inWindow: boolean
  bookings: number
  tickets: number
  capacity: number | null
  seatsLeft: number | null
  waiting: number
  revenueAed: number
  costsAed: number
  profitAed: number
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const round2 = (n: number) => Math.round(n * 100) / 100

export async function buildEventSalesReport(now = new Date()): Promise<{
  rows: EventSalesRow[]
  inWindow: EventSalesRow[]
  windowDays: number
}> {
  const [eventsRes, regsRes, ticketsRes, paymentsRes, costsRes, waitlistRes] = await Promise.all([
    supabaseAdmin.from('events').select('id, title, event_date, end_date, capacity_limit').eq('status', 'published'),
    supabaseAdmin.from('event_registrations').select('event_id, ticket_id, ticket_name, quantity, guest_names, status'),
    supabaseAdmin.from('event_tickets').select('id, event_id, name, cost_price_aed'),
    supabaseAdmin.from('payments').select('event_id, revenue_aed, refunded_aed, stripe_fee_aed, fee_passed_on_aed'),
    supabaseAdmin.from('operating_costs').select('event_id, amount_aed'),
    supabaseAdmin.from('event_waitlist').select('event_id, status'),
  ])

  const events = eventsRes.data || []
  const regs = regsRes.data || []
  const tickets = ticketsRes.data || []
  const payments = paymentsRes.data || []
  const costs = costsRes.data || []
  const waitlist = waitlistRes.data || []

  // Ticket cost prices, looked up by id and by name. The name is the fallback
  // because a guest carries the package name, not its id.
  const costById = new Map(tickets.map(t => [String(t.id), num(t.cost_price_aed)]))
  const costByEventAndName = new Map(
    tickets.map(t => [`${String(t.event_id)}::${String(t.name)}`, num(t.cost_price_aed)]),
  )

  const nowMs = now.getTime()

  const rows: EventSalesRow[] = events
    .filter(e => new Date(String(e.end_date || e.event_date)).getTime() > nowMs)
    .map(e => {
      const id = String(e.id)
      const paid = regs.filter(r => String(r.event_id) === id && r.status === 'paid')

      let tickets_ = 0
      let directCost = 0
      for (const r of paid) {
        tickets_ += num(r.quantity) || 1
        directCost += costById.get(String(r.ticket_id))
          ?? costByEventAndName.get(`${id}::${String(r.ticket_name)}`)
          ?? 0
        const guests = Array.isArray(r.guest_names) ? r.guest_names : []
        for (const g of guests) {
          const name = typeof g === 'string' ? String(r.ticket_name || '') : String((g as { ticket_name?: string })?.ticket_name || '')
          directCost += costByEventAndName.get(`${id}::${name}`) ?? 0
        }
      }

      const pays = payments.filter(p => String(p.event_id || '') === id)
      const revenue = pays.reduce((s, p) => s + num(p.revenue_aed) - num(p.refunded_aed), 0)
      // Negative means the surcharge over-recovered, which is a gain rather
      // than a cost, so it is floored at zero exactly as the dashboard does.
      const unrecoveredStripe = Math.max(0, pays.reduce((s, p) => s + num(p.stripe_fee_aed) - num(p.fee_passed_on_aed), 0))
      const attributed = costs.filter(c => String(c.event_id || '') === id).reduce((s, c) => s + num(c.amount_aed), 0)
      const total = directCost + attributed + unrecoveredStripe

      const capacity = e.capacity_limit == null ? null : Number(e.capacity_limit)
      const daysAway = Math.ceil((new Date(String(e.event_date)).getTime() - nowMs) / 86400000)

      return {
        id,
        title: String(e.title),
        date: String(e.event_date),
        daysAway,
        inWindow: daysAway <= REPORT_WINDOW_DAYS,
        bookings: paid.length,
        tickets: tickets_,
        capacity,
        seatsLeft: capacity == null ? null : Math.max(0, capacity - tickets_),
        waiting: waitlist.filter(w => String(w.event_id) === id && w.status === 'waiting').length,
        revenueAed: round2(revenue),
        costsAed: round2(total),
        profitAed: round2(revenue - total),
      }
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return { rows, inWindow: rows.filter(r => r.inWindow), windowDays: REPORT_WINDOW_DAYS }
}
