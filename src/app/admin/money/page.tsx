import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNav from '@/components/admin/AdminNav'
import { MONEY_COOKIE, verifyMoneyToken } from '@/lib/admin-auth'
import MoneyClient from './MoneyClient'
import MoneyLock from './MoneyLock'
import { summariseYear, yearOf, PaymentRow, CostRow } from '@/lib/money'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type Row = Record<string, unknown>

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0))
  return Number.isFinite(n) ? n : 0
}

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  // Gated before anything is read, deliberately. Returning early means no
  // revenue, cost or profit figure is ever queried, let alone serialised into
  // the page, until the second password check has passed.
  if (!(await verifyMoneyToken(cookies().get(MONEY_COOKIE)?.value))) {
    return (
      <div className="min-h-screen bg-charcoal-900">
        <AdminNav subtitle="Money" />
        <MoneyLock />
      </div>
    )
  }

  const [paymentsRes, costsRes, eventsRes, ticketsRes, regsRes, settingsRes] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('id, paid_at, kind, description, event_id, reference_id, gross_aed, revenue_aed, fee_passed_on_aed, stripe_fee_aed, refunded_aed, created_at, source'),
    supabaseAdmin
      .from('operating_costs')
      .select('id, incurred_on, category, description, amount_aed, event_id')
      .order('incurred_on', { ascending: false }),
    supabaseAdmin.from('events').select('id, title, event_date'),
    supabaseAdmin.from('event_tickets').select('id, event_id, name, cost_price_aed'),
    supabaseAdmin
      .from('event_registrations')
      .select('event_id, ticket_id, ticket_name, quantity, guest_names, status'),
    supabaseAdmin.from('admin_settings').select('last_stripe_import_at').eq('id', 1).maybeSingle(),
  ])

  // A missing ledger table is the normal state until the migration is run,
  // so say so plainly instead of rendering a dashboard full of zeroes.
  if (paymentsRes.error) {
    return (
      <div className="min-h-screen bg-charcoal-900">
        <AdminNav subtitle="Money" />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-white mb-3">Money dashboard not set up yet</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            The payment ledger table has not been created. Run{' '}
            <code className="text-gold-400">supabase/money-dashboard.sql</code> in the Supabase SQL editor, then
            reload this page and run the Stripe import.
          </p>
          <p className="text-gray-600 text-xs mt-4">{paymentsRes.error.message}</p>
        </div>
      </div>
    )
  }

  const payments = (paymentsRes.data as unknown as PaymentRow[]) || []
  const costRows = (costsRes.data as Row[]) || []
  const events = (eventsRes.data as Row[]) || []
  const tickets = (ticketsRes.data as Row[]) || []
  const regs = ((regsRes.data as Row[]) || []).filter(r => r.status === 'paid')

  const costs: CostRow[] = costRows.map(c => ({
    incurred_on: String(c.incurred_on),
    category: String(c.category || 'Other'),
    description: String(c.description || ''),
    amount_aed: num(c.amount_aed),
    event_id: c.event_id ? String(c.event_id) : null,
  }))

  // ---- direct event costs: the cost price of every ticket actually sold ----
  const costById = new Map(tickets.map(t => [String(t.id), num(t.cost_price_aed)]))
  const costByEventAndName = new Map(
    tickets.map(t => [`${String(t.event_id)}::${String(t.name)}`, num(t.cost_price_aed)]),
  )
  const directByEvent = new Map<string, number>()
  const ticketsByEvent = new Map<string, number>()

  for (const r of regs) {
    const eventId = String(r.event_id)
    ticketsByEvent.set(eventId, (ticketsByEvent.get(eventId) || 0) + (num(r.quantity) || 1))

    // The buyer's own ticket.
    let total = costById.get(String(r.ticket_id)) ?? costByEventAndName.get(`${eventId}::${String(r.ticket_name)}`) ?? 0
    // Each named guest is priced by their own chosen package, not the buyer's.
    const guests = Array.isArray(r.guest_names) ? r.guest_names : []
    for (const g of guests) {
      const ticketName = typeof g === 'string' ? String(r.ticket_name || '') : String((g as Row)?.ticket_name || '')
      total += costByEventAndName.get(`${eventId}::${ticketName}`) ?? 0
    }
    directByEvent.set(eventId, (directByEvent.get(eventId) || 0) + total)
  }

  const eventDirect = Array.from(directByEvent.entries()).map(([eventId, costAed]) => ({ eventId, costAed }))
  const ticketCounts = Array.from(ticketsByEvent.entries()).map(([eventId, t]) => ({ eventId, tickets: t }))
  const eventList = events.map(e => ({ id: String(e.id), title: String(e.title), date: String(e.event_date) }))

  // ---- which years to offer ----
  // Every year that has data, plus the current year so a brand new year is
  // selectable from 1 January. Future years are never shown: the provision
  // for 2027 and beyond is simply that they appear as they arrive.
  const thisYear = new Date().getFullYear()
  const dataYears = new Set<number>([thisYear, thisYear - 1])
  for (const p of payments) dataYears.add(yearOf(p.paid_at))
  for (const c of costs) dataYears.add(yearOf(c.incurred_on))
  const years = Array.from(dataYears)
    .filter(y => y <= thisYear && y >= 2019)
    .sort((a, b) => b - a)

  const requested = Number(searchParams.year)
  const year = years.includes(requested) ? requested : years[0]

  const summary = summariseYear(year, payments, costs, eventDirect, eventList, ticketCounts)

  // Prior year, for the change indicators. Undefined in the first year.
  const prevYear = years.includes(year - 1)
    ? summariseYear(year - 1, payments, costs, eventDirect, eventList, ticketCounts)
    : null

  // When the import was last run. Falls back to the newest reconstructed row
  // in the ledger, so the date is still right if the settings column has not
  // been added yet.
  const settings = settingsRes.data as Row | null
  const stampedImport = settings?.last_stripe_import_at
    ? String(settings.last_stripe_import_at)
    : null
  const derivedImport = ((paymentsRes.data as Row[]) || [])
    .filter(p => p.source === 'backfill' && p.created_at)
    .map(p => String(p.created_at))
    .sort()
    .pop() ?? null
  const lastImportAt = stampedImport ?? derivedImport

  const incomeLines = ((paymentsRes.data as Row[]) || [])
    .filter(p => p.source === 'manual' && yearOf(String(p.paid_at)) === year)
    .sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)))
    .map(p => ({
      id: String(p.id),
      paidOn: String(p.paid_at),
      kind: String(p.kind),
      description: String(p.description || ''),
      amountAed: num(p.revenue_aed),
      eventTitle: p.event_id ? eventList.find(e => e.id === String(p.event_id))?.title ?? null : null,
    }))

  const costLines = costRows
    .filter(c => yearOf(String(c.incurred_on)) === year)
    .map(c => ({
      id: String(c.id),
      incurredOn: String(c.incurred_on),
      category: String(c.category || 'Other'),
      description: String(c.description || ''),
      amountAed: num(c.amount_aed),
      eventTitle: c.event_id ? eventList.find(e => e.id === String(c.event_id))?.title ?? null : null,
    }))

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Money" />
      <MoneyClient
        summary={summary}
        previous={prevYear ? { revenue: prevYear.revenue, totalCosts: prevYear.totalCosts, profit: prevYear.profit } : null}
        years={years}
        costLines={costLines}
        events={eventList}
        hasLedger={payments.length > 0}
        lastImportAt={lastImportAt}
        incomeLines={incomeLines}
      />
    </div>
  )
}
