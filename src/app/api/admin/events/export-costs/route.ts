import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { cardFeeAed } from '@/lib/fees'

export const dynamic = 'force-dynamic'
// Reads every booking and cost row before it can answer.
export const maxDuration = 60

// Admin-only export of per-ticket cost vs. selling price, for profit
// tracking. Unlike the door list export, this includes cost_price_aed -
// it must never be reachable without a valid admin session.
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
      'Cost price (AED)': buyerTicket?.cost_price_aed ?? '',
      'Selling price (AED)': buyerTicket?.price_aed ?? '',
      'Stripe fee (AED)': stripeFee,
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
        'Cost price (AED)': guestTicket?.cost_price_aed ?? '',
        'Selling price (AED)': guestTicket?.price_aed ?? '',
        'Stripe fee (AED)': '', // already shown once on the buyer's row above
        Status: r.status,
      })
    })
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ticket Costs')
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
