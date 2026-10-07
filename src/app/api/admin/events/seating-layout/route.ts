import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken, sessionIdentity } from '@/lib/admin-auth'
import { reportError } from '@/lib/report-error'
import {
  copyLayout, reconcileLayout, validateLayout, applyMapping, invertMapping, isPermutation, isIdentity, FloorLayout, Mapping,
} from '@/lib/floor-plan'

export const dynamic = 'force-dynamic'

// The saved floor plan for an event's tables, who is editing it, and renumbering.
//
// LIVE-DATA RULES:
// - Saving or copying a layout writes ONLY the two layout columns of one event.
// - Claiming, refreshing or releasing the edit lease writes ONLY the lease
//   columns of one event.
// - Renumbering is the only operation that touches bookings, and it does so
//   through one database function (renumber_event_tables) that changes the
//   plan and every booking's table together in a single transaction, refuses a
//   locked event, and keeps an undo record.
// - None of it ever changes table_count, seats_per_table, the lock, or a
//   booking's group, name, payment or status.

const BASE_COLUMNS = 'seating_enabled, table_count, seats_per_table, seating_locked_at, seating_layout, seating_layout_updated_at'
const TOOL_COLUMNS = 'seating_edit_by, seating_edit_name, seating_edit_until, seating_edit_started_at, seating_last_renumber'
const LEASE_MS = 2 * 60 * 1000

type EventRow = {
  seating_enabled: boolean | null
  table_count: number | null
  seats_per_table: number | null
  seating_locked_at: string | null
  seating_layout: FloorLayout | null
  seating_layout_updated_at: string | null
  seating_edit_by?: string | null
  seating_edit_name?: string | null
  seating_edit_until?: string | null
  seating_edit_started_at?: string | null
  seating_last_renumber?: { inverse?: Mapping; at?: string; label?: string } | null
}

async function authed(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

// Distinguishes "the SQL has not been run yet" from a real failure.
function columnsMissing(error: { code?: string; message?: string } | null, pattern: RegExp) {
  return !!error && (error.code === '42703' || pattern.test(error.message || ''))
}

async function loadEvent(eventId: string): Promise<{ event: EventRow | null; missing?: boolean; failed?: boolean; tools: boolean }> {
  // Ask for everything first. If the lease and renumber columns are not there
  // yet (the second SQL has not been run) fall back to the layout columns, and
  // the plan simply works without the one-editor lock.
  let res = await supabaseAdmin.from('events').select(`${BASE_COLUMNS}, ${TOOL_COLUMNS}`).eq('id', eventId).maybeSingle()
  let tools = true
  if (columnsMissing(res.error, /seating_edit|seating_last_renumber/) && !/seating_layout/.test(res.error?.message || '')) {
    tools = false
    res = await supabaseAdmin.from('events').select(BASE_COLUMNS).eq('id', eventId).maybeSingle()
  }
  if (columnsMissing(res.error, /seating_layout/)) return { event: null, missing: true, tools: false }
  if (res.error) { reportError('floor plan: could not read the event', res.error.message); return { event: null, failed: true, tools } }
  return { event: res.data as EventRow | null, tools }
}

// Who is asking: an account (or the shared login) plus this browser window, so
// two windows of the same person cannot both be editing.
async function whoAmI(req: NextRequest, clientId: unknown): Promise<{ key: string; name: string } | null> {
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(clientId)) return null
  const id = await sessionIdentity(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!id) return null
  let name = 'The admin'
  if (id !== 'legacy') {
    const { data } = await supabaseAdmin.from('admin_users').select('name, email').eq('id', id).maybeSingle()
    const r = data as { name?: string; email?: string } | null
    name = r?.name || r?.email || 'An admin'
  }
  return { key: `${id}:${clientId}`, name }
}

function leaseView(ev: EventRow, tools: boolean, myKey: string | null) {
  if (!tools) return { supported: false, active: false, mine: false, name: null, since: null, until: null }
  const active = !!ev.seating_edit_until && new Date(ev.seating_edit_until).getTime() > Date.now()
  return {
    supported: true,
    active,
    mine: active && !!myKey && ev.seating_edit_by === myKey,
    name: active ? ev.seating_edit_name ?? 'Another admin' : null,
    since: active ? ev.seating_edit_started_at ?? null : null,
    until: active ? ev.seating_edit_until ?? null : null,
  }
}

// Every change must come from whoever holds the lease (when leases exist).
function leaseProblem(ev: EventRow, tools: boolean, me: { key: string } | null): NextResponse | null {
  if (!tools) return null
  const v = leaseView(ev, true, me?.key ?? null)
  if (v.mine) return null
  return NextResponse.json({
    error: v.active ? `${v.name} is editing this plan right now.` : 'Press Edit plan first, so only one person changes the plan at a time.',
    leaseLost: true,
  }, { status: 409 })
}

// Writes ONLY the two layout columns, and only if nobody else saved since this
// editor loaded: the stored timestamp must still equal `expected`.
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
    if (columnsMissing(error, /seating_layout/)) return NextResponse.json({ sources: [] })
    if (error) { reportError('floor plan: could not list copy sources', error.message); return NextResponse.json({ error: 'Could not load events.' }, { status: 500 }) }
    return NextResponse.json({
      sources: (data || []).map(e => ({ id: e.id, title: e.title, eventDate: e.event_date, tableCount: e.table_count })),
    })
  }

  const { event, missing, failed, tools } = await loadEvent(eventId)
  if (missing) return NextResponse.json({ available: false, reason: 'not_set_up' })
  if (failed) return NextResponse.json({ error: 'Could not load the floor plan.' }, { status: 503 })
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (!event.seating_enabled || !event.table_count || !event.seats_per_table) {
    return NextResponse.json({ available: false, reason: 'seating_not_configured' })
  }

  const me = await whoAmI(req, req.nextUrl.searchParams.get('clientId'))
  const lease = leaseView(event, tools, me?.key ?? null)
  // A light poll while someone is just looking: only who is editing.
  if (req.nextUrl.searchParams.get('leaseOnly') === '1') return NextResponse.json({ lease })

  // Always agrees with the event's current table count; never saved by a read.
  const { layout, added, dropped } = reconcileLayout(event.seating_layout, event.table_count, event.seats_per_table)
  const lr = event.seating_last_renumber
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
    lease,
    toolsReady: tools,
    lastRenumber: lr?.inverse ? { at: lr.at ?? null, label: lr.label ?? '' } : null,
  })
}

export async function PUT(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const eventId = typeof body?.eventId === 'string' ? body.eventId : ''
  const expected = typeof body?.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : null
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  const { event, missing, failed, tools } = await loadEvent(eventId)
  if (missing) return NextResponse.json({ error: 'The floor plan has not been switched on yet (one database update is needed).' }, { status: 409 })
  if (failed) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 503 })
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (!event.seating_enabled || !event.table_count || !event.seats_per_table) {
    return NextResponse.json({ error: 'Set the number of tables and seats per table first.' }, { status: 400 })
  }
  if (event.seating_locked_at) {
    return NextResponse.json({ error: 'Seating is locked for this event. Unlock it in the list view to change the plan.' }, { status: 409 })
  }
  const problem = leaseProblem(event, tools, await whoAmI(req, body?.clientId))
  if (problem) return problem

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

export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const action = body?.action
  const eventId = typeof body?.eventId === 'string' ? body.eventId : typeof body?.toEventId === 'string' ? body.toEventId : ''

  // ---- The edit lease ----------------------------------------------------
  if (action === 'claim' || action === 'heartbeat' || action === 'release') {
    const me = await whoAmI(req, body?.clientId)
    if (!me || !eventId) return NextResponse.json({ error: 'Missing details.' }, { status: 400 })
    const { event, missing, failed, tools } = await loadEvent(eventId)
    if (missing) return NextResponse.json({ error: 'The floor plan has not been switched on yet.' }, { status: 409 })
    if (failed) return NextResponse.json({ error: 'Please try again.' }, { status: 503 })
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    if (!tools) return NextResponse.json({ ok: true, lease: leaseView(event, false, null) })   // no lock available yet

    const now = new Date()
    const until = new Date(now.getTime() + LEASE_MS).toISOString()
    if (action === 'release') {
      await supabaseAdmin.from('events').update({ seating_edit_by: null, seating_edit_name: null, seating_edit_until: null, seating_edit_started_at: null })
        .eq('id', eventId).eq('seating_edit_by', me.key)
      return NextResponse.json({ ok: true })
    }
    if (action === 'heartbeat') {
      const { data } = await supabaseAdmin.from('events').update({ seating_edit_until: until }).eq('id', eventId).eq('seating_edit_by', me.key).select('id')
      if (!data || data.length !== 1) return NextResponse.json({ error: 'Another admin has taken over editing.', leaseLost: true }, { status: 409 })
      return NextResponse.json({ ok: true, until })
    }
    // claim: free, expired, or already mine; or an explicit take-over.
    const takeover = body?.takeover === true
    let q = supabaseAdmin.from('events').update({
      seating_edit_by: me.key, seating_edit_name: me.name, seating_edit_until: until, seating_edit_started_at: now.toISOString(),
    }).eq('id', eventId)
    if (!takeover) q = q.or(`seating_edit_until.is.null,seating_edit_until.lt.${now.toISOString()},seating_edit_by.eq.${me.key}`)
    const { data, error } = await q.select('id')
    if (error) { reportError('floor plan: could not claim editing', error.message); return NextResponse.json({ error: 'Could not start editing. Please try again.' }, { status: 500 }) }
    if (!data || data.length !== 1) {
      const cur = await loadEvent(eventId)
      return NextResponse.json({ error: 'Someone else is editing this plan.', lease: cur.event ? leaseView(cur.event, true, me.key) : null }, { status: 409 })
    }
    return NextResponse.json({ ok: true, until })
  }

  // ---- Renumbering: guests follow their table ---------------------------
  if (action === 'renumber') {
    if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
    const { event, missing, failed, tools } = await loadEvent(eventId)
    if (missing || !tools) return NextResponse.json({ error: 'Renumbering needs one more database update (supabase/event-seating-plan-tools.sql).' }, { status: 409 })
    if (failed) return NextResponse.json({ error: 'Could not renumber. Please try again.' }, { status: 503 })
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    if (!event.seating_enabled || !event.table_count || !event.seats_per_table) {
      return NextResponse.json({ error: 'Set the number of tables and seats per table first.' }, { status: 400 })
    }
    if (event.seating_locked_at) return NextResponse.json({ error: 'Seating is locked, so tables cannot be renumbered. Unlock it first.' }, { status: 409 })
    const problem = leaseProblem(event, true, await whoAmI(req, body?.clientId))
    if (problem) return problem

    const undo = body?.undo === true
    const mapping = undo ? event.seating_last_renumber?.inverse : body?.mapping
    if (!isPermutation(mapping, event.table_count)) {
      return NextResponse.json({ error: undo ? 'There is nothing to undo.' : 'That numbering is not valid.' }, { status: 400 })
    }
    if (isIdentity(mapping)) return NextResponse.json({ error: 'No table would change number.' }, { status: 400 })

    // The new plan is built from what is STORED (never from the browser), so a
    // renumber cannot smuggle in other layout changes.
    const stored = reconcileLayout(event.seating_layout, event.table_count, event.seats_per_table).layout
    const renumbered = applyMapping(stored, mapping)
    const v = validateLayout(renumbered, event.table_count, event.seats_per_table)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

    const label = typeof body?.label === 'string' ? body.label.replace(/[<>\u0000-\u001f]/g, '').slice(0, 80) : ''
    const { data, error } = await supabaseAdmin.rpc('renumber_event_tables', {
      p_event_id: eventId,
      p_mapping: mapping,
      p_layout: v.layout,
      p_expected: event.seating_layout_updated_at,
      p_undo: undo ? null : { inverse: invertMapping(mapping), at: new Date().toISOString(), label },
    })
    if (error) {
      const m = error.message || ''
      if (/conflict/.test(m)) return NextResponse.json({ error: 'Someone else changed this plan since you opened it. Reload and try again.', conflict: true }, { status: 409 })
      if (/locked/.test(m)) return NextResponse.json({ error: 'Seating is locked, so tables cannot be renumbered.' }, { status: 409 })
      if (/bad_mapping/.test(m)) return NextResponse.json({ error: 'That numbering is not valid.' }, { status: 400 })
      reportError('floor plan: renumbering failed', m)
      return NextResponse.json({ error: 'Could not renumber. Nothing was changed.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, updatedAt: (data as { updatedAt?: string })?.updatedAt, bookingsUpdated: (data as { bookingsUpdated?: number })?.bookingsUpdated ?? 0 })
  }

  // ---- Copy another event's layout --------------------------------------
  if (action !== 'copy') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
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
  const problem = leaseProblem(t, target.tools, await whoAmI(req, body?.clientId))
  if (problem) return problem

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
