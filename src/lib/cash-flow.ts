// The arithmetic behind an event's Cash flow view. Pure, so it can be checked
// on its own. Nothing here touches the database, and nothing here feeds the
// profit figures: cash flow is about WHEN money moves, profit is about
// whether the event made money.

import type { EventRegistration, EventTicket } from '@/lib/events'

export type CardSales = {
  gross: number       // what customers were charged by card
  stripeFees: number  // what Stripe deducted
  refunds: number     // given back
  net: number         // gross - fees - refunds: what reaches BILD
  payments: number
}

export type CashLine = {
  id: string
  date: string        // yyyy-mm-dd
  description: string
  amountAed: number
  settled: boolean
}

export type CashRevenueLine = CashLine & { kind: string }
export type CashCostLine = CashLine & { category: string }

// One actual payment made towards a cost, on the date it really went out. A
// cost paid in two instalments has two of these.
export type CostPayment = { id: string; costId: string; date: string; amountAed: number }

export type TimelineRow = {
  key: string
  kind: 'card' | 'revenue' | 'cost' | 'venue' | 'unscheduled'
  date: string | null
  description: string
  inAed: number
  outAed: number
  settled: boolean
  overdue: boolean
  running: number
  // What a row stands for, so the page knows what pressing its button changes.
  // For a cost row, costId says which cost's payments to open.
  line?: { type: 'revenue' | 'cost' | 'venue' | 'costpay'; id: string; costId?: string }
  // True when the cost this row belongs to has actual payments recorded.
  split?: boolean
}

export type CashFlowSummary = {
  cashIn: number
  paidOut: number
  cashNow: number
  toReceive: number
  toPay: number
  expectedEnd: number
  hotelBill: number
  hotelScheduled: number
  hotelUnscheduled: number
  hotelOver: number
  timeline: TimelineRow[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

// The hotel / venue bill: the ticket cost prices added up over every person
// who holds a paid ticket. Mirrors the cost the event's profit figure uses, so
// the two always agree: a complimentary or Ticketsfy ticket costs BILD nothing
// here, exactly as it does there.
export function hotelBillAed(registrations: EventRegistration[], tickets: EventTicket[]): number {
  const byName = new Map(tickets.map(t => [t.name, t]))
  let total = 0
  for (const r of registrations) {
    if (r.status !== 'paid' || r.is_complimentary) continue
    total += Number(byName.get(r.ticket_name || '')?.cost_price_aed) || 0
    for (const g of r.guest_names || []) {
      total += Number(byName.get(g.ticket_name || '')?.cost_price_aed) || 0
    }
  }
  return round2(total)
}

// A cost as cash sees it. With no payments recorded it is one line, paid or not
// according to its flag, dated by the cost. Once any actual payment is recorded
// the flag stops mattering: each payment is a line on the day it went out, and
// whatever is left of the cost is a line still to pay, dated by the cost.
export function costCashLines(costs: CashCostLine[], payments: CostPayment[]): (CashLine & { costId: string; split: boolean; payment: boolean })[] {
  const out: (CashLine & { costId: string; split: boolean; payment: boolean })[] = []
  for (const c of costs) {
    const mine = payments.filter(p => p.costId === c.id)
    if (mine.length === 0) {
      out.push({ ...c, costId: c.id, split: false, payment: false })
      continue
    }
    for (const p of [...mine].sort((a, b) => a.date.localeCompare(b.date))) {
      out.push({ id: p.id, date: p.date, description: `${c.description} (payment)`, amountAed: p.amountAed, settled: true, costId: c.id, split: true, payment: true })
    }
    const left = round2(c.amountAed - mine.reduce((n, p) => n + p.amountAed, 0))
    if (left > 0.004) {
      out.push({ id: c.id, date: c.date, description: `${c.description} (balance still to pay)`, amountAed: left, settled: false, costId: c.id, split: true, payment: false })
    }
  }
  return out
}

export function buildCashFlow(input: {
  card: CardSales
  revenue: CashRevenueLine[]
  costs: CashCostLine[]
  costPayments?: CostPayment[]
  venue: CashLine[]
  hotelBill: number
  today: string
}): CashFlowSummary {
  const { card, revenue, venue, hotelBill, today } = input
  const costs = costCashLines(input.costs, input.costPayments || [])

  const settledRevenue = revenue.filter(r => r.settled).reduce((s, r) => s + r.amountAed, 0)
  const unsettledRevenue = revenue.filter(r => !r.settled).reduce((s, r) => s + r.amountAed, 0)
  const settledCosts = costs.filter(c => c.settled).reduce((s, c) => s + c.amountAed, 0)
  const unsettledCosts = costs.filter(c => !c.settled).reduce((s, c) => s + c.amountAed, 0)
  const settledVenue = venue.filter(v => v.settled).reduce((s, v) => s + v.amountAed, 0)
  const unsettledVenue = venue.filter(v => !v.settled).reduce((s, v) => s + v.amountAed, 0)
  const venueAll = settledVenue + unsettledVenue

  // What is left of the hotel bill once everything entered (paid or planned)
  // is taken off. Until it is scheduled, it is still money that has to be paid.
  const hotelUnscheduled = Math.max(0, hotelBill - venueAll)
  const hotelOver = Math.max(0, venueAll - hotelBill)

  const cashIn = card.net + settledRevenue
  const paidOut = settledCosts + settledVenue
  const toReceive = unsettledRevenue
  const toPay = unsettledCosts + unsettledVenue + hotelUnscheduled

  // The timeline: card sales first (they build up over many days, so one row),
  // then every dated line in date order, then the part of the hotel bill that
  // nobody has given a date yet. The running total assumes each line happens
  // on its date.
  type Draft = Omit<TimelineRow, 'running'>
  const dated: Draft[] = [
    ...revenue.map((r): Draft => ({
      key: `revenue:${r.id}`, kind: 'revenue', date: r.date, description: r.description,
      inAed: r.amountAed, outAed: 0, settled: r.settled, overdue: !r.settled && r.date < today,
      line: { type: 'revenue', id: r.id },
    })),
    ...costs.map((c): Draft => ({
      key: `${c.payment ? 'costpay' : 'cost'}:${c.id}`, kind: 'cost', date: c.date, description: c.description,
      inAed: 0, outAed: c.amountAed, settled: c.settled, overdue: !c.settled && c.date < today,
      line: { type: c.payment ? 'costpay' : 'cost', id: c.id, costId: c.costId },
      split: c.split,
    })),
    ...venue.map((v): Draft => ({
      key: `venue:${v.id}`, kind: 'venue', date: v.date, description: v.description,
      inAed: 0, outAed: v.amountAed, settled: v.settled, overdue: !v.settled && v.date < today,
      line: { type: 'venue', id: v.id },
    })),
  ].sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  const drafts: Draft[] = []
  if (card.payments > 0) {
    drafts.push({
      key: 'card', kind: 'card', date: null,
      description: `Card sales received (${card.payments} payment${card.payments === 1 ? '' : 's'}, after Stripe fees and refunds)`,
      inAed: card.net, outAed: 0, settled: true, overdue: false,
    })
  }
  drafts.push(...dated)
  if (hotelUnscheduled > 0) {
    drafts.push({
      key: 'unscheduled', kind: 'unscheduled', date: null,
      description: 'Rest of the hotel / venue bill, no payment date entered yet',
      inAed: 0, outAed: hotelUnscheduled, settled: false, overdue: false,
    })
  }

  let running = 0
  const timeline = drafts.map(d => {
    running = round2(running + d.inAed - d.outAed)
    return { ...d, running }
  })

  return {
    cashIn: round2(cashIn),
    paidOut: round2(paidOut),
    cashNow: round2(cashIn - paidOut),
    toReceive: round2(toReceive),
    toPay: round2(toPay),
    expectedEnd: round2(cashIn - paidOut + toReceive - toPay),
    hotelBill: round2(hotelBill),
    hotelScheduled: round2(venueAll),
    hotelUnscheduled: round2(hotelUnscheduled),
    hotelOver: round2(hotelOver),
    timeline,
  }
}
