import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { reportError } from '@/lib/report-error'
import { copyLayout, reconcileLayout, validateLayout, FloorLayout } from '@/lib/floor-plan'

export const dynamic = 'force-dynamic'

// The saved floor plan for an event's tables.
//
// LIVE-DATA RULE: this route only ever writes the two layout columns
// (seating_layout, seating_layout_updated_at) of one event. It never touches
// table_count, seats_per_table, the lock, or any booking. How many tables there
// are stays whatever the event's own settings say; the plan follows it.

const COLUMNS = 'seating_enabled, table_count, seats_per_table, seating_locked_at, seating_layout, seating_layout_updated_at'

type EventRow = {
  seating_enabled: boolean | null
  table_count: number | null
  seats_per_table: number | null
  seating_locked_at: string | null
  seating_layout: FloorLayout | null
  seating_layout_updated_at: string | null
}

async function authed(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

// Distinguishes "the SQL has not been run yet" from a real failure. Until the
// columns exist the floor plan simply does not appear.
function columnsMissing(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === '42703' || /seating_layout/.test(error.message || ''))
}

async function loadEvent(eventId: string): Promise<{ event: EventRow | null; missing?: boolean; failed?: boolean }> {
  const { data, error } = await supabaseAdmin.from('events').select(COLUMNS).eq('id', eventId).maybeSingle()
  if (columnsMissing(error)) return { event: null, missing: true }
  if (error) { reportError('floor plan: could not read the event', error.message); return { event: null, failed: true } }
  return { event: (data as EventRow | null) }
}

// Writes ONLY the two layout columns, and only if nobody else saved since this
// editor loaded: the stored timestamp must still equal `expected` (or both be
// empty). Two admins can edit now, so a silent overwrite is not acceptable.
async function saveLayout(eventId: string, layout: FloorLayout, expected: string | null): Promise<{ ok: true; updatedAt: string } | { ok: false; conflict?: boolean }> {
  const updatedAt = new Date().toISOString()
  let q = supabaseAdmin
    .from('events')
    .update({ seating_layout: layout, seating_layout_updated_at: updatedAt })
    .eq('id', eventId)
  q = expected === null ? q.is('seating_layout_updated_at', null) : q.eq('seating_layout_updated_at', expected)
  const { data, error } = await q.select('id')
  if (error) { reportError('floor plan: could not save the layout', error.message); return { ok: false } }
  if (!data || data.length !== 1) return { ok: false, conflict: true }
  return { ok: true, updatedAt }
}

export async function GET(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const eventId = req.nextUrl.searchParams.get('eventId') || ''
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  // Events that already have a plan, offered as a source for "Copy layout".
  if (req.nextUrl.searchParams.get('sources') === '1') {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('id, title, event_date, table_count, seating_layout')
      .not('seating_layout', 'is', null)
      .neq('id', eventId)
      .order('event_date', { ascending: false })
      .limit(30)
    if (columnsMissing(error)) return NextResponse.json({ sources: [] })
    if (error) { reportError('floor plan: could not list copy sources', error.message); return NextResponse.json({ error: 'Could not load events.' }, { status: 500 }) }
    return NextResponse.json({
      sources: (data || []).map(e => ({ id: e.id, title: e.title, eventDate: e.event_date, tableCount: e.table_count })),
    })
  }

  const { event, missing, failed } = await loadEvent(eventId)
  if (missing) return NextResponse.json({ available: false, reason: 'not_set_up' })
  if (failed) return NextResponse.json({ error: 'Could not load the floor plan.' }, { status: 503 })
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (!event.seating_enabled || !event.table_count || !event.seats_per_table) {
    return NextResponse.json({ available: false, reason: 'seating_not_configured' })
  }

  // Always agrees with the event's current table count; never saved by a read.
  const { layout, added, dropped } = reconcileLayout(event.seating_layout, event.table_count, event.seats_per_table)
  return NextResponse.json({
    available: true,
    saved: !!event.seating_layout,
    layout,
    added,
    dropped,
    updatedAt: event.seating_layout_updated_at,
    tableCount: event.table_count,
    seatsPerTable: event.seats_per_table,
    locked: !!event.seating_locked_at,
  })
}

export async function PUT(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const eventId = typeof body?.eventId === 'string' ? body.eventId : ''
  const expected = typeof body?.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : null
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  const { event, missing, failed } = await loadEvent(eventId)
  if (missing) return NextResponse.json({ error: 'The floor plan has not been switched on yet (one database update is needed).' }, { status: 409 })
  if (failed) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 503 })
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (!event.seating_enabled || !event.table_count || !event.seats_per_table) {
    return NextResponse.json({ error: 'Set the number of tables and seats per table first.' }, { status: 400 })
  }
  if (event.seating_locked_at) {
    return NextResponse.json({ error: 'Seating is locked for this event. Unlock it in the list view to change the plan.' }, { status: 409 })
  }

  const v = validateLayout(body?.layout, event.table_count, event.seats_per_table)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const saved = await saveLayout(eventId, v.layout, expected)
  if (!saved.ok) {
    return saved.conflict
      ? NextResponse.json({ error: 'Someone else changed this plan since you opened it. Reload to see their changes.', conflict: true }, { status: 409 })
      : NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt })
}

// Copy another event's room, tables and labels onto this one. Never copies who
// sits where.
export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (body?.action !== 'copy') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  const toId = typeof body.toEventId === 'string' ? body.toEventId : ''
  const fromId = typeof body.fromEventId === 'string' ? body.fromEventId : ''
  const expected = typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : null
  if (!toId || !fromId || toId === fromId) return NextResponse.json({ error: 'Choose an event to copy from.' }, { status: 400 })

  const target = await loadEvent(toId)
  if (target.missing) return NextResponse.json({ error: 'The floor plan has not been switched on yet (one database update is needed).' }, { status: 409 })
  if (target.failed) return NextResponse.json({ error: 'Could not copy. Please try again.' }, { status: 503 })
  const t = target.event
  if (!t) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (!t.seating_enabled || !t.table_count || !t.seats_per_table) {
    return NextResponse.json({ error: 'Set the number of tables and seats per table first.' }, { status: 400 })
  }
  if (t.seating_locked_at) return NextResponse.json({ error: 'Seating is locked for this event.' }, { status: 409 })

  const source = await loadEvent(fromId)
  if (source.failed) return NextResponse.json({ error: 'Could not copy. Please try again.' }, { status: 503 })
  const sv = validateLayout(source.event?.seating_layout, source.event?.table_count ?? t.table_count, t.seats_per_table)
  if (!sv.ok) return NextResponse.json({ error: 'That event has no saved floor plan to copy.' }, { status: 404 })

  const layout = copyLayout(sv.layout, t.table_count, t.seats_per_table)
  const saved = await saveLayout(toId, layout, expected)
  if (!saved.ok) {
    return saved.conflict
      ? NextResponse.json({ error: 'Someone else changed this plan since you opened it. Reload and try again.', conflict: true }, { status: 409 })
      : NextResponse.json({ error: 'Could not copy. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt })
}
