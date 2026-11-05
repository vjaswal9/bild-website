// Reads a guest list exported from a ticketing partner (Ticketsfy) so those
// guests can be recorded in BILD for seating and the door list. Pure helpers
// only: reading the file, finding the columns, and grouping people into
// parties. Nothing here touches the database.
import * as XLSX from 'xlsx'

export type SheetRecord = Record<string, string>

// A header with the case, spaces and punctuation taken out, so "Attendee Name",
// "attendee_name" and "ATTENDEE-NAME" all compare equal.
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// The first header found for each field, tried in this order. An export's
// exact wording is not known in advance, so a few common spellings are accepted
// and the preview says which column was used for what.
const CANDIDATES = {
  first: ['firstname', 'givenname', 'attendeefirstname', 'guestfirstname', 'fname'],
  last: ['lastname', 'surname', 'familyname', 'attendeelastname', 'guestlastname', 'lname'],
  full: ['name', 'fullname', 'attendeename', 'guestname', 'ticketholder', 'ticketholdername', 'attendee', 'customername', 'buyername'],
  email: ['email', 'emailaddress', 'attendeeemail', 'guestemail', 'buyeremail', 'customeremail'],
  phone: ['phone', 'mobile', 'mobilenumber', 'phonenumber', 'contactnumber', 'whatsapp', 'attendeephone', 'buyerphone'],
  ticket: ['tickettype', 'tickettypename', 'ticketname', 'ticket', 'category', 'tickettier', 'ticketcategory'],
  order: ['orderid', 'ordernumber', 'orderno', 'orderreference', 'orderref', 'order', 'bookingid', 'bookingreference', 'transactionid', 'invoice'],
  barcode: ['barcode', 'ticketid', 'ticketnumber', 'ticketno', 'qrcode', 'ticketcode', 'serial'],
} as const

export type ColumnMap = { -readonly [K in keyof typeof CANDIDATES]?: string }

const MAX_ROWS = 600

export function readSheet(buffer: Buffer): { headers: string[]; records: SheetRecord[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { headers: [], records: [] }
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  const records = raw.slice(0, MAX_ROWS).map(r => {
    const out: SheetRecord = {}
    for (const [k, v] of Object.entries(r)) out[k.trim()] = String(v ?? '').trim()
    return out
  })
  const headers = records.length ? Object.keys(records[0]) : []
  return { headers, records }
}

export function mapColumns(headers: string[]): ColumnMap {
  const bySquashed = new Map(headers.map(h => [squash(h), h]))
  const map: ColumnMap = {}
  for (const [field, names] of Object.entries(CANDIDATES) as [keyof typeof CANDIDATES, readonly string[]][]) {
    const hit = names.find(n => bySquashed.has(n))
    if (hit) map[field] = bySquashed.get(hit)
  }
  return map
}

// How a person's name is compared: case, spacing and punctuation ignored.
export const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export type GuestRow = {
  n: number              // line in the file, 1 = first person (header excluded)
  firstName: string
  lastName: string
  email: string
  phone: string
  ticket: string         // the ticket type as the file names it
  party: string          // rows sharing this are booked together (same order, or same email)
  ref: string            // order or barcode, kept in the booking's note
}

export function rowsFromRecords(records: SheetRecord[], cols: ColumnMap): GuestRow[] {
  const get = (r: SheetRecord, col?: string) => (col ? r[col] ?? '' : '')
  return records
    .map((r, i): GuestRow => {
      let first = get(r, cols.first)
      let last = get(r, cols.last)
      if (!first && !last) {
        const full = get(r, cols.full).replace(/\s+/g, ' ').trim()
        const space = full.indexOf(' ')
        first = space === -1 ? full : full.slice(0, space)
        last = space === -1 ? '' : full.slice(space + 1)
      }
      const email = get(r, cols.email).toLowerCase()
      const order = get(r, cols.order)
      return {
        n: i + 1,
        firstName: first.trim(),
        lastName: last.trim(),
        email,
        phone: get(r, cols.phone),
        ticket: get(r, cols.ticket),
        party: order ? `o:${order}` : email ? `e:${email}` : `r:${i + 1}`,
        ref: [order, get(r, cols.barcode)].filter(Boolean).join(' / '),
      }
    })
    .filter(r => r.firstName || r.lastName || r.email)
    .map(numberRepeatedNames(!!cols.order))
}

// Some exports put the BUYER's name on every ticket of an order: three tickets
// bought by one person arrive as three rows with the same name, and the other
// holders' names are not in the file. Those rows are separate tickets, not
// duplicates, so each repeat gets a number ("Asha Patel (guest 2)") and the
// admin can rename it later. Only done when the file has order numbers: without
// them a repeated name is more likely the same row listed twice.
function numberRepeatedNames(hasOrder: boolean) {
  const seen = new Map<string, number>()
  return (r: GuestRow): GuestRow => {
    if (!hasOrder || !r.party.startsWith('o:')) return r
    const key = `${r.party}|${nameKey(`${r.firstName} ${r.lastName}`)}`
    const n = (seen.get(key) || 0) + 1
    seen.set(key, n)
    return n === 1 ? r : { ...r, lastName: `${r.lastName} (guest ${n})`.trim() }
  }
}

// Every person already booked on the event, by name, so the guests Ticketsfy
// took over (already in BILD) are not added a second time.
export function existingNameKeys(
  regs: { first_name: string | null; last_name: string | null; guest_names: unknown }[],
): Set<string> {
  const keys = new Set<string>()
  for (const r of regs) {
    keys.add(nameKey(`${r.first_name || ''} ${r.last_name || ''}`))
    const guests = Array.isArray(r.guest_names) ? r.guest_names : []
    for (const g of guests) {
      const name = typeof g === 'string' ? g : (g as { name?: string })?.name || ''
      if (name) keys.add(nameKey(name))
    }
  }
  keys.delete('')
  return keys
}
