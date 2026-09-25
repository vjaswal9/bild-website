import * as XLSX from 'xlsx'
import { supabaseAdmin } from './supabase-admin'
import { readAllRows } from './db-retry'
import { isPastEvent, type GuestEntry } from './events'

// Builds the spreadsheet that backs up every upcoming event: one sheet listing
// all the bookings and the money, then a door list per event in exactly the
// shape the door staff already use.
//
// The weekly backup used to cover members only. Ticket sales, guest names,
// dietary requirements and the door lists themselves lived in one database and
// nowhere else, which is not a safe place for the only copy of who is allowed
// through the door on the night.

function dietaryLabel(d: unknown, note?: unknown): string {
  const v = typeof d === 'string' ? d : ''
  const n = typeof note === 'string' ? note.trim() : ''
  if (v === 'vegetarian') return 'Vegetarian'
  if (v === 'vegan') return 'Vegan'
  if (v === 'other') return n ? `Other: ${n}` : 'Other'
  return ''
}

// Excel refuses these characters in a tab name and truncates past 31
// characters, so a long event title has to be shortened rather than left to
// break the whole file.
function sheetName(title: string, taken: Set<string>): string {
  const base = (title || 'Event').replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Event'
  let name = base
  let n = 2
  while (taken.has(name.toLowerCase())) {
    const suffix = ` ${n++}`
    name = base.slice(0, 31 - suffix.length) + suffix
  }
  taken.add(name.toLowerCase())
  return name
}

const guestsOf = (r: Record<string, unknown>): GuestEntry[] =>
  Array.isArray(r.guest_names) ? (r.guest_names as GuestEntry[]) : []

export async function buildEventsWorkbook(): Promise<{
  buffer: Buffer
  events: number
  bookings: number
  attendees: number
}> {
  // As with the members backup: paged, and raised rather than swallowed. An
  // events file that quietly comes back empty is worse than no file, because
  // it is the door list somebody would be relying on at the venue.
  const { data: eventRows, error: eventsError } = await readAllRows<Record<string, unknown>>(
    'events backup',
    (from, to) => supabaseAdmin
      .from('events')
      .select('*')
      .eq('status', 'published')
      .order('event_date', { ascending: true })
      .range(from, to),
  )
  if (eventsError) {
    const reason = (eventsError as { message?: string }).message || String(eventsError)
    throw new Error(`The events list could not be read, so no backup was produced: ${reason}`)
  }

  // Only what is still to come. A backup exists to get an event run if the
  // database is lost, and an event that already happened cannot be rescued.
  const events = (eventRows || []).filter(e => !isPastEvent(e as { event_date: string; end_date?: string | null }))

  const wb = XLSX.utils.book_new()
  const taken = new Set<string>()
  let bookings = 0
  let attendees = 0

  // ---- Sheet 1: every booking, with the money, across all upcoming events.
  const bookingRows: Record<string, unknown>[] = []

  // ---- Then one door list per event.
  const doorSheets: { name: string; rows: Record<string, unknown>[] }[] = []

  // Every booking for every upcoming event, in one read rather than one read
  // per event. The loop below used to issue a query per event and wait for
  // each in turn, so a backup covering twenty events made twenty-one round
  // trips one after another. That was the dominant cost of the weekly job and
  // the main reason it risked running out of time.
  const eventIds = events.map(e => (e as Record<string, unknown>).id as string)
  const byEvent = new Map<string, Record<string, unknown>[]>()
  if (eventIds.length) {
    const { data: allRegs, error: regError } = await readAllRows<Record<string, unknown>>(
      'door lists for the events backup',
      (from, to) => supabaseAdmin
        .from('event_registrations')
        .select('*')
        .in('event_id', eventIds)
        .order('last_name', { ascending: true })
        .range(from, to),
    )
    if (regError) {
      const reason = (regError as { message?: string }).message || String(regError)
      throw new Error(`The bookings could not be read, so no backup was produced: ${reason}`)
    }
    for (const r of allRegs) {
      const key = String(r.event_id)
      const list = byEvent.get(key)
      if (list) list.push(r)
      else byEvent.set(key, [r])
    }
  }

  for (const ev of events) {
    const e = ev as Record<string, unknown>
    const regs = byEvent.get(String(e.id)) || []
    const door: Record<string, unknown>[] = []

    for (const r of regs) {
      bookings += 1
      const guests = guestsOf(r)
      bookingRows.push({
        Event: e.title,
        'Event date': e.event_date,
        Status: r.status,
        Booked: r.created_at,
        'Buyer first name': r.first_name,
        'Buyer last name': r.last_name,
        Email: r.email,
        Phone: r.phone || '',
        'Buyer ticket': r.ticket_name || '',
        People: r.quantity,
        Guests: guests.map(g => `${g.name}${g.ticket_name ? ` (${g.ticket_name})` : ''}`).join('; '),
        'Amount AED': r.amount_aed,
        'Refunded AED': r.refunded_amount_aed || 0,
        Dietary: dietaryLabel(r.dietary, r.dietary_note),
        'Admin notes': r.admin_note || '',
      })

      // The door list is paid bookings only, matching the export the admin
      // already produces, so the backup copy and the live one cannot disagree.
      if (r.status !== 'paid') continue
      const buyer = `${r.first_name || ''} ${r.last_name || ''}`.trim()
      if (buyer) {
        door.push({
          Name: buyer,
          Phone: r.phone || '',
          'Ticket type': r.ticket_name || '',
          Dietary: dietaryLabel(r.dietary, r.dietary_note),
        })
      }
      for (const g of guests) {
        const name = typeof g === 'string' ? g : g?.name || ''
        if (!name) continue
        door.push({
          Name: name,
          Phone: '',
          'Ticket type': (typeof g === 'string' ? (r.ticket_name as string) : g.ticket_name) || '',
          Dietary: typeof g === 'string' ? '' : dietaryLabel(g.dietary, g.dietary_note),
        })
      }
    }

    attendees += door.length
    doorSheets.push({
      name: sheetName(`${e.title}`, taken),
      // An event with no bookings yet still gets its sheet, so the absence is
      // visible rather than looking like a file that failed to build.
      rows: door.length ? door : [{ Name: 'No paid bookings yet', Phone: '', 'Ticket type': '', Dietary: '' }],
    })
  }

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      bookingRows.length ? bookingRows : [{ Event: 'No upcoming events with bookings' }],
    ),
    'All bookings',
  )
  for (const s of doorSheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name)
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return { buffer, events: events.length, bookings, attendees }
}
