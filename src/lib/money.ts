// Shared money/P&L model. Used by the Stripe webhook (writing the ledger),
// the backfill route (reconstructing it) and the admin Money dashboard
// (reading it), so revenue is defined in exactly one place.

export type PaymentKind = 'membership' | 'event_ticket' | 'listing' | 'featured' | 'sponsorship' | 'other'

export const KIND_LABELS: Record<PaymentKind, string> = {
  membership: 'Memberships',
  event_ticket: 'Event tickets',
  listing: 'Directory listings',
  featured: 'Featured placements',
  sponsorship: 'Sponsorships',
  other: 'Other income',
}

// Offered on an event's own cost lines. Deliberately concrete: these are
// the things that actually get paid for at a BILD event.
export const EVENT_COST_CATEGORIES = [
  'DJ & music',
  'Lighting & AV',
  'Venue',
  'Catering',
  'Bar & drinks',
  'Decor & production',
  'Photography & video',
  'Entertainment',
  'Security & staffing',
  'Gifts & prizes',
  'Marketing',
  'Other',
] as const

export const EVENT_REVENUE_KINDS = [
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'other', label: 'Other revenue' },
] as const

export const COST_CATEGORIES = [
  'Venue',
  'Catering',
  'Entertainment',
  'Decor & production',
  'Photography & video',
  'Trade licence & legal',
  'Software & hosting',
  'Marketing',
  'Gifts & prizes',
  'Other',
] as const

export type PaymentRow = {
  paid_at: string
  kind: PaymentKind
  event_id: string | null
  reference_id: string | null
  gross_aed: number
  revenue_aed: number
  fee_passed_on_aed: number
  stripe_fee_aed: number
  refunded_aed: number
}

export type CostRow = {
  incurred_on: string
  category: string
  description: string
  amount_aed: number
  event_id: string | null
}

export type MonthPoint = { month: string; revenue: number; costs: number; profit: number }
export type StreamPoint = { kind: PaymentKind; label: string; revenue: number; count: number }
export type CostPoint = { label: string; amount: number }
export type EventPoint = {
  id: string
  title: string
  date: string
  tickets: number
  revenue: number
  costs: number
  profit: number
}

export type YearSummary = {
  year: number
  grossCollected: number
  revenue: number
  refunds: number
  feePassedOn: number
  stripeFeeTotal: number
  netStripeCost: number
  eventDirectCosts: number
  otherCosts: number
  totalCosts: number
  profit: number
  margin: number
  transactions: number
  byMonth: MonthPoint[]
  byStream: StreamPoint[]
  costBreakdown: CostPoint[]
  byEvent: EventPoint[]
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0))
  return Number.isFinite(n) ? n : 0
}

export const round2 = (n: number): number => Math.round(n * 100) / 100

export function yearOf(dateStr: string): number {
  return new Date(dateStr).getUTCFullYear()
}

/**
 * Builds the whole P&L for one year.
 *
 * The one subtlety worth stating plainly: Stripe's fee is charged on every
 * payment, but on event tickets the buyer is surcharged for it at checkout,
 * so BILD gets that money back. `netStripeCost` is therefore the total fee
 * Stripe took MINUS what was recovered from buyers, which is the number that
 * actually comes out of BILD's pocket. It never goes below zero: a small
 * over-recovery on one booking does not become income.
 */
export function summariseYear(
  year: number,
  payments: PaymentRow[],
  costs: CostRow[],
  eventDirect: { eventId: string; costAed: number }[],
  events: { id: string; title: string; date: string }[],
  ticketCounts: { eventId: string; tickets: number }[],
): YearSummary {
  const yearPayments = payments.filter(p => yearOf(p.paid_at) === year)
  const yearCosts = costs.filter(c => yearOf(c.incurred_on) === year)

  const sum = (rows: PaymentRow[], key: keyof PaymentRow) =>
    rows.reduce((s, r) => s + num(r[key]), 0)

  const grossCollected = sum(yearPayments, 'gross_aed')
  const refunds = sum(yearPayments, 'refunded_aed')
  const revenueBeforeRefunds = sum(yearPayments, 'revenue_aed')
  const revenue = revenueBeforeRefunds - refunds
  const feePassedOn = sum(yearPayments, 'fee_passed_on_aed')
  const stripeFeeTotal = sum(yearPayments, 'stripe_fee_aed')
  const netStripeCost = Math.max(0, stripeFeeTotal - feePassedOn)

  // Events that sold tickets or took sponsorship money this year, plus any
  // event that only has costs against it: an event that cost money and
  // earned nothing still belongs in the year's figures.
  const yearEventIds = new Set<string>([
    ...yearPayments.filter(p => p.event_id).map(p => p.event_id as string),
    ...yearCosts.filter(c => c.event_id).map(c => c.event_id as string),
  ])
  const eventDirectCosts = eventDirect
    .filter(e => yearEventIds.has(e.eventId))
    .reduce((s, e) => s + e.costAed, 0)

  const otherCosts = yearCosts.reduce((s, c) => s + num(c.amount_aed), 0)
  const totalCosts = netStripeCost + eventDirectCosts + otherCosts
  const profit = revenue - totalCosts
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0

  // ---- by month ----
  const byMonth: MonthPoint[] = MONTHS.map((m, i) => {
    const monthPayments = yearPayments.filter(p => new Date(p.paid_at).getUTCMonth() === i)
    const monthRevenue =
      monthPayments.reduce((s, p) => s + num(p.revenue_aed) - num(p.refunded_aed), 0)
    const monthStripe = Math.max(
      0,
      monthPayments.reduce((s, p) => s + num(p.stripe_fee_aed) - num(p.fee_passed_on_aed), 0),
    )
    const monthOther = yearCosts
      .filter(c => new Date(c.incurred_on).getUTCMonth() === i)
      .reduce((s, c) => s + num(c.amount_aed), 0)
    // Direct event costs land in the month the event's tickets were sold,
    // apportioned by that month's share of the event's ticket revenue.
    let monthEventDirect = 0
    for (const ed of eventDirect) {
      const allForEvent = yearPayments.filter(p => p.event_id === ed.eventId)
      const total = allForEvent.reduce((s, p) => s + num(p.revenue_aed), 0)
      if (total <= 0) continue
      const inMonth = allForEvent
        .filter(p => new Date(p.paid_at).getUTCMonth() === i)
        .reduce((s, p) => s + num(p.revenue_aed), 0)
      monthEventDirect += ed.costAed * (inMonth / total)
    }
    const monthCosts = monthStripe + monthOther + monthEventDirect
    return {
      month: m,
      revenue: round2(monthRevenue),
      costs: round2(monthCosts),
      profit: round2(monthRevenue - monthCosts),
    }
  })

  // ---- by revenue stream ----
  const kinds: PaymentKind[] = ['membership', 'event_ticket', 'listing', 'featured', 'sponsorship', 'other']
  const byStream: StreamPoint[] = kinds
    .map(kind => {
      const rows = yearPayments.filter(p => p.kind === kind)
      return {
        kind,
        label: KIND_LABELS[kind],
        revenue: round2(rows.reduce((s, p) => s + num(p.revenue_aed) - num(p.refunded_aed), 0)),
        count: rows.length,
      }
    })
    .filter(s => s.revenue !== 0 || s.count > 0)

  // ---- cost breakdown ----
  const byCategory = new Map<string, number>()
  for (const c of yearCosts) {
    byCategory.set(c.category, (byCategory.get(c.category) || 0) + num(c.amount_aed))
  }
  const costBreakdown: CostPoint[] = [
    { label: 'Stripe fees (not recovered)', amount: round2(netStripeCost) },
    { label: 'Event direct costs', amount: round2(eventDirectCosts) },
    ...Array.from(byCategory.entries()).map(([label, amount]) => ({ label, amount: round2(amount) })),
  ].filter(c => c.amount > 0)

  // ---- per event ----
  const ticketsByEvent = new Map(ticketCounts.map(t => [t.eventId, t.tickets]))
  const directByEvent = new Map(eventDirect.map(e => [e.eventId, e.costAed]))
  const byEvent: EventPoint[] = events
    .filter(e => yearEventIds.has(e.id))
    .map(e => {
      const rows = yearPayments.filter(p => p.event_id === e.id)
      const rev = rows.reduce((s, p) => s + num(p.revenue_aed) - num(p.refunded_aed), 0)
      const stripe = Math.max(
        0,
        rows.reduce((s, p) => s + num(p.stripe_fee_aed) - num(p.fee_passed_on_aed), 0),
      )
      const attributed = yearCosts
        .filter(c => c.event_id === e.id)
        .reduce((s, c) => s + num(c.amount_aed), 0)
      const cost = (directByEvent.get(e.id) || 0) + attributed + stripe
      return {
        id: e.id,
        title: e.title,
        date: e.date,
        tickets: ticketsByEvent.get(e.id) || 0,
        revenue: round2(rev),
        costs: round2(cost),
        profit: round2(rev - cost),
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return {
    year,
    grossCollected: round2(grossCollected),
    revenue: round2(revenue),
    refunds: round2(refunds),
    feePassedOn: round2(feePassedOn),
    stripeFeeTotal: round2(stripeFeeTotal),
    netStripeCost: round2(netStripeCost),
    eventDirectCosts: round2(eventDirectCosts),
    otherCosts: round2(otherCosts),
    totalCosts: round2(totalCosts),
    profit: round2(profit),
    margin: round2(margin),
    transactions: yearPayments.length,
    byMonth,
    byStream,
    costBreakdown,
    byEvent,
  }
}

// AED with no decimals for big headline figures, two for small ones.
export function formatAed(n: number, decimals = 0): string {
  return n.toLocaleString('en-AE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
