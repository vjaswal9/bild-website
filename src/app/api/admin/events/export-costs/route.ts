import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { cardFeeAed } from '@/lib/fees'
import { summariseMerchPayments } from '@/lib/event-merch'

export const dynamic = 'force-dynamic'
// Reads every booking and cost row before it can answer.
export const maxDuration = 60

// Admin-only export of per-ticket cost vs. selling price, for profit
// tracking, plus the event's additional revenue and costs and a Summary tab
// that totals everything. Unlike the door list export, this includes
// cost_price_aed - it must never be reachable without a valid admin session.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('title, slug')
    .eq('id', eventId)
    .maybeSingle()

  const { data: ticketRows } = await supabaseAdmin
    .from('event_tickets')
    .select('id, name, price_aed, cost_price_aed')
    .eq('event_id', eventId)
  const ticketsById = new Map((ticketRows || []).map(t => [t.id, t]))
  const ticketsByName = new Map((ticketRows || []).map(t => [t.name, t]))

  const { data } = await supabaseAdmin
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'paid')
    .order('last_name', { ascending: true })

  const regs = data || []

  // One row per attendee (primary buyer + each named guest), each priced
  // by their own ticket type - not the total amount on the booking.
  const rows: Record<string, unknown>[] = []
  regs.forEach((r: Record<string, unknown>) => {
    const isComp = !!r.is_complimentary
    const buyer = `${r.first_name} ${r.last_name}`.trim()
    const buyerTicket = ticketsById.get(r.ticket_id as string) || ticketsByName.get(r.ticket_name as string)
    // The card processing fee is charged once per booking (covering the
    // buyer + all their guests together), never per individual ticket -
    // shown only on the buyer's row so it isn't double-counted.
    const bookingSubtotal = Number(r.amount_aed) || 0
    const stripeFee = bookingSubtotal > 0 ? Math.round(cardFeeAed(bookingSubtotal) * 100) / 100 : ''
    rows.push({
      Name: buyer,
      Email: r.email,
      'Ticket type': r.ticket_name || '',
      'Cost price (AED)': isComp ? 0 : (buyerTicket?.cost_price_aed ?? ''),
      'Selling price (AED)': isComp ? 0 : (buyerTicket?.price_aed ?? ''),
      'Stripe fee (AED)': stripeFee,
      Comp: isComp ? 'Yes' : '',
      Status: r.status,
    })
    const guests = Array.isArray(r.guest_names) ? r.guest_names : []
    guests.forEach((g: unknown) => {
      const name = typeof g === 'string' ? g : ((g as { name?: string })?.name || '')
      const ticketName = typeof g === 'string' ? (r.ticket_name as string || '') : ((g as { ticket_name?: string })?.ticket_name || '')
      if (!name) return
      const guestTicket = ticketsByName.get(ticketName)
      rows.push({
        Name: name,
        Email: r.email, // guests don't have their own email on file - shown against the buyer's
        'Ticket type': ticketName,
        'Cost price (AED)': isComp ? 0 : (guestTicket?.cost_price_aed ?? ''),
        'Selling price (AED)': isComp ? 0 : (guestTicket?.price_aed ?? ''),
        'Stripe fee (AED)': '', // already shown once on the buyer's row above
        Comp: isComp ? 'Yes' : '',
        Status: r.status,
      })
    })
  })

  // Additional revenue and costs recorded against this event in the Manage
  // panel, read the same way that panel reads them (see the finances route).
  const [extraRevRes, extraCostRes, merchRes, feeRes] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('paid_at, kind, description, revenue_aed')
      .eq('event_id', eventId)
      .eq('source', 'manual')
      .order('paid_at', { ascending: true }),
    supabaseAdmin
      .from('operating_costs')
      .select('incurred_on, category, description, amount_aed')
      .eq('event_id', eventId)
      .order('incurred_on', { ascending: true }),
    supabaseAdmin
      .from('payments')
      .select('id, paid_at, kind, description, revenue_aed, refunded_aed')
      .eq('event_id', eventId)
      .eq('kind', 'other')
      .in('source', ['webhook', 'backfill'])
      .order('paid_at', { ascending: true }),
    supabaseAdmin
      .from('payments')
      .select('stripe_fee_aed, fee_passed_on_aed')
      .eq('event_id', eventId),
  ])
  if (extraRevRes.error || extraCostRes.error || merchRes.error || feeRes.error) {
    return NextResponse.json({ error: 'Could not read the additional revenue and costs for this event.' }, { status: 500 })
  }

  const round2 = (n: number) => Math.round(n * 100) / 100
  const revenueLines = [
    ...(extraRevRes.data || []).map(r => ({
      Date: String(r.paid_at).slice(0, 10),
      Type: r.kind === 'sponsorship' ? 'Sponsorship' : 'Other income',
      Description: r.description || '',
      'Amount (AED)': Number(r.revenue_aed) || 0,
    })),
    ...summariseMerchPayments(merchRes.data || [], eventId).map(m => ({
      Date: m.date,
      Type: 'Sold at the event',
      Description: m.sold != null ? `${m.description}: ${m.sold} sold` : `${m.description}: ${m.payments} payment${m.payments === 1 ? '' : 's'}`,
      'Amount (AED)': m.amountAed,
    })),
  ].sort((a, b) => a.Date.localeCompare(b.Date))
  const costLines = (extraCostRes.data || []).map(c => ({
    Date: String(c.incurred_on).slice(0, 10),
    Category: c.category || 'Other',
    Description: c.description || '',
    'Amount (AED)': Number(c.amount_aed) || 0,
  }))
  // The card fee BILD ended up absorbing, floored at zero exactly as the
  // Money dashboard and the Manage panel do.
  const cardFeeAbsorbed = round2(Math.max(
    0,
    (feeRes.data || []).reduce((s, p) => s + (Number(p.stripe_fee_aed) || 0) - (Number(p.fee_passed_on_aed) || 0), 0),
  ))

  const sumOf = (list: { 'Amount (AED)': number }[]) => round2(list.reduce((s, l) => s + l['Amount (AED)'], 0))
  const ticketRevenue = round2(rows.reduce((s, r) => s + (Number(r['Selling price (AED)']) || 0), 0))
  const ticketCosts = round2(rows.reduce((s, r) => s + (Number(r['Cost price (AED)']) || 0), 0))
  const extraRevenue = sumOf(revenueLines)
  const extraCosts = sumOf(costLines)
  const totalRevenue = round2(ticketRevenue + extraRevenue)
  const totalCosts = round2(ticketCosts + extraCosts + cardFeeAbsorbed)
  const profit = round2(totalRevenue - totalCosts)

  const summary: (string | number)[][] = [
    [(event as { title?: string })?.title || 'Event', ''],
    ['All amounts in AED', ''],
    ['', ''],
    ['REVENUE', ''],
    ['Ticket sales', ticketRevenue],
    ['Additional revenue', extraRevenue],
    ['Total revenue', totalRevenue],
    ['', ''],
    ['COSTS', ''],
    ['Ticket cost prices', ticketCosts],
    ['Additional costs', extraCosts],
    ['Card fees absorbed by BILD', cardFeeAbsorbed],
    ['Total costs', totalCosts],
    ['', ''],
    ['PROFIT', profit],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summary)
  summaryWs['!cols'] = [{ wch: 32 }, { wch: 16 }]

  const withTotal = <T extends { 'Amount (AED)': number }>(list: T[], label: string, emptyNote: string) => {
    if (list.length === 0) return XLSX.utils.json_to_sheet([{ Description: emptyNote }])
    const sheet = XLSX.utils.json_to_sheet([...list, { Description: label, 'Amount (AED)': sumOf(list) }])
    sheet['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 40 }, { wch: 14 }]
    return sheet
  }

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ticket Costs')
  XLSX.utils.book_append_sheet(wb, withTotal(revenueLines, 'Total additional revenue', 'No additional revenue recorded for this event'), 'Additional Revenue')
  XLSX.utils.book_append_sheet(wb, withTotal(costLines, 'Total additional costs', 'No additional costs recorded for this event'), 'Additional Costs')
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const name = (event as { slug?: string })?.slug || 'event'
  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="BILD-ticket-costs-${name}-${today}.xlsx"`,
    },
  })
}
