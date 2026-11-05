import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'
import { generateSeatingCode } from '@/lib/seating-code'
import { GuestEntry } from '@/lib/events'
import {
  readSheet, mapColumns, rowsFromRecords, existingNameKeys, nameKey, GuestRow, ColumnMap,
} from '@/lib/guest-import'

export const dynamic = 'force-dynamic'

const MAX_FILE_BYTES = 2 * 1024 * 1024

// Stamped on every imported booking: shown to admins and as the door list's
// Source column.
const SOURCE_LABEL = 'TICKETSFY IMPORT'

// Admin-only: records guests who bought through the ticketing partner
// (Ticketsfy) so they can be seated and appear on the door list.
//
// Nothing is charged and no email is sent: the money and the barcodes are the
// partner's. Each import is saved the same way an admin-issued complimentary
// ticket is (a paid, capacity-counted, seatable booking flagged
// `is_complimentary`, so BILD's reports do not count it as BILD revenue or
// cost), with a note saying where it came from.
//
// Each person's ticket type must be one of the event's own packages; a row
// whose type is not is held back with a reason rather than guessed at.
//
// Two steps, both on this route: a preview (the file is read and checked, and
// nothing is saved) and the import (the checked rows are saved).

type EventTicketRow = { id: string; name: string; active: boolean }

async function loadEvent(eventId: string) {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, title, capacity_limit, seating_enabled, seats_per_table')
    .eq('id', eventId)
    .maybeSingle()
  const { data: tickets } = await supabaseAdmin
    .from('event_tickets')
    .select('id, name, active')
    .eq('event_id', eventId)
  const { data: regs } = await supabaseAdmin
    .from('event_registrations')
    .select('id, first_name, last_name, email, quantity, seating_code, guest_names, status')
    .eq('event_id', eventId)
    .eq('status', 'paid')
  return { event, tickets: (tickets || []) as EventTicketRow[], regs: regs || [] }
}

// Preview: read the file and say what would happen to each person.
async function preview(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const eventId = String(form?.get('eventId') || '')
  const file = form?.get('file')
  if (!eventId || !(file instanceof File)) {
    return NextResponse.json({ error: 'Please choose an event and a file.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'That file is too large. A guest list should be well under 2 MB.' }, { status: 400 })
  }

  const { event, tickets, regs } = await loadEvent(eventId)
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

  let sheet
  try {
    sheet = readSheet(Buffer.from(await file.arrayBuffer()))
  } catch {
    return NextResponse.json({ error: 'That file could not be read. Please upload the CSV or Excel file exactly as Ticketsfy sent it.' }, { status: 400 })
  }
  if (sheet.records.length === 0) {
    return NextResponse.json({ error: 'The file has no guests in it.' }, { status: 400 })
  }

  const cols: ColumnMap = mapColumns(sheet.headers)
  if (!cols.first && !cols.full) {
    return NextResponse.json({
      error: `No name column was found. The columns in the file are: ${sheet.headers.join(', ')}. Please rename the name column to "Name" (or "First name" and "Last name") and try again.`,
    }, { status: 400 })
  }
  if (!cols.email) {
    return NextResponse.json({
      error: `No email column was found. The columns in the file are: ${sheet.headers.join(', ')}. Please rename the email column to "Email" and try again.`,
    }, { status: 400 })
  }

  const rows = rowsFromRecords(sheet.records, cols)
  const already = existingNameKeys(regs)
  const ticketKeys = new Map(tickets.map(t => [nameKey(t.name), t]))

  // The email that will be used for each party: the first valid one in it.
  const partyEmail = new Map<string, string>()
  for (const r of rows) {
    if (!partyEmail.has(r.party) && isValidEmail(r.email)) partyEmail.set(r.party, normaliseEmail(r.email))
  }

  const seenInFile = new Set<string>()
  const out = rows.map(r => {
    const name = `${r.firstName} ${r.lastName}`.trim()
    const key = nameKey(name)
    let status: 'new' | 'exists' | 'problem' = 'new'
    let reason = ''
    if (!key) { status = 'problem'; reason = 'No name' }
    else if (!partyEmail.has(r.party)) { status = 'problem'; reason = r.email ? 'Email address does not look valid' : 'No email address for this booking' }
    else if (!ticketKeys.get(nameKey(r.ticket))) { status = 'problem'; reason = r.ticket ? `"${r.ticket}" is not one of this event's ticket packages` : 'No ticket type in the file' }
    else if (already.has(key)) { status = 'exists'; reason = 'Already booked in BILD' }
    else if (seenInFile.has(`${r.party}|${key}`)) { status = 'exists'; reason = 'Listed twice in the file' }
    seenInFile.add(`${r.party}|${key}`)
    return {
      ...r,
      name,
      email: partyEmail.get(r.party) || r.email,
      ticketMatched: !!ticketKeys.get(nameKey(r.ticket)),
      status,
      reason,
    }
  })

  const soldQty = regs.reduce((s, r) => s + (Number(r.quantity) || 1), 0)
  return NextResponse.json({
    columns: cols,
    rows: out,
    truncated: sheet.records.length >= 600,
    bookedNow: soldQty,
    capacityLimit: event.capacity_limit,
    seatingEnabled: !!event.seating_enabled,
  })
}

type IncomingRow = GuestRow & { force?: boolean }

// Import: save the rows the admin ticked.
async function commit(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const eventId = String(body.eventId || '')
  const incoming: IncomingRow[] = Array.isArray(body.rows) ? body.rows : []
  if (!eventId || incoming.length === 0) {
    return NextResponse.json({ error: 'Nothing to import.' }, { status: 400 })
  }
  if (incoming.length > 600) return NextResponse.json({ error: 'Too many guests in one import.' }, { status: 400 })

  const { event, tickets, regs } = await loadEvent(eventId)
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  const ticketByKey = new Map(tickets.map(t => [nameKey(t.name), t]))

  const already = existingNameKeys(regs)
  const clean = (v: unknown) => String(v ?? '').trim()

  // Re-check every row here: the page is not trusted to have checked it, and a
  // second press of the button must not add anyone twice.
  type Good = { firstName: string; lastName: string; email: string; phone: string; ticket: string; party: string; ref: string }
  const good: Good[] = []
  const skipped: { name: string; reason: string }[] = []
  const seen = new Set<string>()
  const emailOfParty = new Map<string, string>()
  for (const r of incoming) {
    const party = clean(r.party)
    if (party && !emailOfParty.has(party) && isValidEmail(clean(r.email))) emailOfParty.set(party, normaliseEmail(clean(r.email)))
  }
  for (const r of incoming) {
    const firstName = clean(r.firstName)
    const lastName = clean(r.lastName)
    const name = `${firstName} ${lastName}`.trim()
    const key = nameKey(name)
    const party = clean(r.party) || `r:${clean(r.n)}`
    if (!key) { skipped.push({ name: name || '(no name)', reason: 'No name' }); continue }
    const email = emailOfParty.get(party)
    if (!email) { skipped.push({ name, reason: 'No valid email address' }); continue }
    if (!ticketByKey.get(nameKey(clean(r.ticket)))) { skipped.push({ name, reason: 'Ticket type is not one of this event\'s packages' }); continue }
    if (!r.force && already.has(key)) { skipped.push({ name, reason: 'Already booked in BILD' }); continue }
    if (seen.has(`${party}|${key}`)) { skipped.push({ name, reason: 'Listed twice' }); continue }
    seen.add(`${party}|${key}`)
    good.push({ firstName, lastName, email, phone: clean(r.phone), ticket: clean(r.ticket), party, ref: clean(r.ref) })
  }
  if (good.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, parties: 0, skipped })
  }

  // Keep each party together: everyone on one order is one booking, which is
  // what the seating plan treats as people who sit together. If the buyer
  // already has a booking on this event, they join its table when it has room.
  const parties = new Map<string, Good[]>()
  for (const g of good) parties.set(g.party, [...(parties.get(g.party) || []), g])

  const codeByEmail = new Map<string, string>()
  const headcountByCode = new Map<string, number>()
  for (const r of regs) {
    if (!r.seating_code) continue
    codeByEmail.set(String(r.email).toLowerCase(), r.seating_code)
    headcountByCode.set(r.seating_code, (headcountByCode.get(r.seating_code) || 0) + (Number(r.quantity) || 1))
  }

  const today = new Date().toLocaleDateString('en-GB')
  const now = new Date().toISOString()
  const toInsert = Array.from(parties.values()).map(members => {
    const buyer = members[0]
    const guestRows = members.slice(1)
    // Every row was checked against the event's packages above, so this always finds one.
    const ticketFor = (t: string) => ticketByKey.get(nameKey(t))!
    const buyerTicket = ticketFor(buyer.ticket)
    const guests: GuestEntry[] = guestRows.map(g => ({
      name: `${g.firstName} ${g.lastName}`.trim(),
      ticket_name: ticketFor(g.ticket).name,
      price_aed: 0,
    }))
    const qty = 1 + guests.length

    let seatingCode: string | null = null
    if (event.seating_enabled) {
      const existing = codeByEmail.get(buyer.email)
      const room = existing != null
        && (event.seats_per_table == null || (headcountByCode.get(existing) || 0) + qty <= event.seats_per_table)
      seatingCode = room && existing ? existing : generateSeatingCode()
      headcountByCode.set(seatingCode, (headcountByCode.get(seatingCode) || 0) + qty)
      codeByEmail.set(buyer.email, seatingCode)
    }
    const refs = Array.from(new Set(members.map(m => m.ref).filter(Boolean))).slice(0, 4).join('; ')
    return {
      event_id: eventId,
      ticket_id: buyerTicket.id,
      ticket_name: buyerTicket.name,
      first_name: buyer.firstName || buyer.lastName,
      last_name: buyer.firstName ? buyer.lastName : '',
      email: buyer.email,
      phone: buyer.phone || null,
      quantity: qty,
      guest_names: guests,
      amount_aed: 0,
      status: 'paid',
      paid_at: now,
      seating_code: seatingCode,
      is_complimentary: true,
      source: SOURCE_LABEL,
      admin_note: `${today}: imported from Ticketsfy${refs ? ` (${refs})` : ''}. Paid through Ticketsfy, not Stripe`,
    }
  })

  const { error } = await supabaseAdmin.from('event_registrations').insert(toInsert)
  if (error) return NextResponse.json({ error: `Could not save: ${error.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, imported: good.length, parties: toInsert.length, skipped })
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const type = req.headers.get('content-type') || ''
  return type.includes('multipart/form-data') ? preview(req) : commit(req)
}
