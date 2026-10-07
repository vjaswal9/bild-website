// Server-only. Everything the A3 seating print needs, read in one place.
//
// This only READS: it never writes a booking, a layout or a draft. The print
// page is admin-only (middleware), and names are personal data, so nothing here
// logs them.
import { supabaseAdmin } from './supabase-admin'
import { reconcileLayout, type FloorLayout } from './floor-plan'

export type PrintMode = 'live' | 'draft'

export type PrintGroup = {
  key: string
  code: string | null
  // The person who booked first: the name that goes on the room plan.
  lead: string
  headcount: number
  // Every named person (booker, then their guests) and how many are unnamed.
  names: string[]
  unnamed: number
  tables: number[]
}

export type PrintData = {
  title: string
  eventDate: string
  venue: string | null
  tableCount: number
  seatsPerTable: number
  locked: boolean
  lockedAt: string | null
  layout: FloorLayout
  groups: PrintGroup[]
  mode: PrintMode
  draftAvailable: boolean
}

type Reg = {
  id: string; first_name: string; last_name: string | null; quantity: number | null
  seating_code: string | null; seating_table: number[] | null; created_at: string; guest_names?: unknown
}

const soloKey = (id: string) => `_solo_${id}`
const fullName = (r: Reg) => `${r.first_name} ${r.last_name || ''}`.trim()

function guestNames(r: Reg): string[] {
  const list = Array.isArray(r.guest_names) ? r.guest_names : []
  return list
    .map(g => (typeof g === 'string' ? g : (g as { name?: string } | null)?.name || ''))
    .map(n => n.trim())
    .filter(Boolean)
}

const sameTables = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false
  const sa = [...a].sort((x, y) => x - y), sb = [...b].sort((x, y) => x - y)
  return sa.every((v, i) => v === sb[i])
}

// Same rule as the list view: a group is seated only if every booking under
// its code agrees on the tables; otherwise it shows as not yet seated.
function liveTables(list: Reg[]): number[] {
  const lists = list.map(r => r.seating_table || [])
  return lists.every(t => sameTables(t, lists[0])) ? lists[0].slice().sort((a, b) => a - b) : []
}

export async function loadSeatingPrint(eventId: string, wanted: PrintMode): Promise<PrintData | { error: string }> {
  const base = await supabaseAdmin
    .from('events')
    .select('title, event_date, venue, seating_enabled, table_count, seats_per_table, seating_locked_at')
    .eq('id', eventId)
    .maybeSingle()
  if (base.error) return { error: 'Could not load the event.' }
  const ev = base.data as {
    title: string; event_date: string; venue: string | null; seating_enabled: boolean | null
    table_count: number | null; seats_per_table: number | null; seating_locked_at: string | null
  } | null
  if (!ev) return { error: 'Event not found.' }
  if (!ev.seating_enabled || !ev.table_count || !ev.seats_per_table) return { error: 'Table seating is not set up for this event.' }

  // The layout and draft live in columns that only exist once the owner has run
  // the floor plan SQL, so they are read separately and may simply be absent.
  const extra = await supabaseAdmin.from('events').select('seating_layout, seating_draft').eq('id', eventId).maybeSingle()
  const row = (extra.error ? null : extra.data) as { seating_layout: FloorLayout | null; seating_draft: { assignments?: Record<string, number[]> } | null } | null
  const draftAvailable = !!row && !extra.error
  const mode: PrintMode = wanted === 'draft' && draftAvailable ? 'draft' : 'live'
  const layout = reconcileLayout(row?.seating_layout ?? null, ev.table_count, ev.seats_per_table).layout

  const regs = await supabaseAdmin
    .from('event_registrations')
    .select('id, first_name, last_name, quantity, seating_code, seating_table, created_at, guest_names')
    .eq('event_id', eventId)
    .eq('status', 'paid')
    .order('created_at', { ascending: true })
  if (regs.error) return { error: 'Could not load the bookings.' }

  const byKey = new Map<string, Reg[]>()
  for (const r of (regs.data || []) as Reg[]) {
    const key = r.seating_code || soloKey(r.id)
    byKey.set(key, [...(byKey.get(key) || []), r])
  }

  const draft = row?.seating_draft?.assignments || {}
  const groups: PrintGroup[] = Array.from(byKey.entries()).map(([key, list]) => {
    const headcount = list.reduce((s, r) => s + (r.quantity || 1), 0)
    const names = list.flatMap(r => [fullName(r), ...guestNames(r)]).filter(Boolean)
    let tables: number[]
    if (mode === 'draft') {
      const d = draft[key]
      tables = Array.isArray(d) ? Array.from(new Set(d.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= ev.table_count!))).sort((a, b) => a - b) : []
    } else {
      tables = liveTables(list)
    }
    return {
      key,
      code: key.startsWith('_solo_') ? null : key,
      lead: fullName(list[0]),
      headcount,
      names,
      unnamed: Math.max(0, headcount - names.length),
      tables,
    }
  })
  groups.sort((a, b) => b.headcount - a.headcount || a.lead.localeCompare(b.lead))

  return {
    title: ev.title,
    eventDate: ev.event_date,
    venue: ev.venue,
    tableCount: ev.table_count,
    seatsPerTable: ev.seats_per_table,
    locked: !!ev.seating_locked_at,
    lockedAt: ev.seating_locked_at,
    layout,
    groups,
    mode,
    draftAvailable,
  }
}
