import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken, sessionIdentity } from '@/lib/admin-auth'
import { reportError } from '@/lib/report-error'

export const dynamic = 'force-dynamic'

// Draft seating: plan who sits at which table WITHOUT changing any booking.
//
// LIVE-DATA RULES:
// - Reading changes nothing.
// - Every draft edit (set, copy_live, auto_assign, clear) writes ONLY the two
//   draft columns of one event (seating_draft, seating_draft_updated_at).
// - The ONLY operations that touch bookings are `commit` and `undo_commit`,
//   each one atomic database function (commit_seating_draft and
//   undo_seating_commit), only on an explicit request, refused when seating is
//   locked, and with the previous live seating kept for undo.
// - Every change needs the edit lease (one editor at a time).

const EVENT_COLUMNS = 'title, event_date, capacity_limit, seating_enabled, table_count, seats_per_table, seating_locked_at, seating_draft, seating_draft_updated_at, seating_last_commit, seating_edit_by, seating_edit_name, seating_edit_until, seating_edit_started_at'

type Draft = { version: 1; assignments: Record<string, number[]> }
type EventRow = {
  title: string; event_date: string; capacity_limit: number | null; seating_enabled: boolean | null
  table_count: number | null; seats_per_table: number | null; seating_locked_at: string | null
  seating_draft: Draft | null; seating_draft_updated_at: string | null
  seating_last_commit: { at?: string } | null
  seating_edit_by: string | null; seating_edit_name: string | null; seating_edit_until: string | null; seating_edit_started_at: string | null
}
type Reg = {
  id: string; first_name: string; last_name: string | null; quantity: number | null
  seating_code: string | null; seating_table: number[] | null; created_at: string; guest_names?: unknown
}

const soloKey = (id: string) => `_solo_${id}`

function guestNames(r: Reg): string[] {
  const list = Array.isArray(r.guest_names) ? r.guest_names : []
  return list.map(g => (typeof g === 'string' ? g : (g as { name?: string } | null)?.name || '')).map(n => n.trim()).filter(Boolean)
}

async function authed(req: NextRequest) { return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value) }

async function who(req: NextRequest, clientId: unknown): Promise<string | null> {
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(clientId)) return null
  const id = await sessionIdentity(req.cookies.get(ADMIN_COOKIE)?.value)
  return id ? `${id}:${clientId}` : null
}

function missing(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === '42703' || /seating_draft|seating_last_commit|seating_edit/.test(error.message || ''))
}

async function loadEvent(eventId: string) {
  const res = await supabaseAdmin.from('events').select(EVENT_COLUMNS).eq('id', eventId).maybeSingle()
  if (missing(res.error)) return { missing: true as const }
  if (res.error) { reportError('draft seating: could not read the event', res.error.message); return { failed: true as const } }
  return { event: res.data as EventRow | null }
}

async function loadGroups(eventId: string) {
  const { data, error } = await supabaseAdmin
    .from('event_registrations')
    .select('id, first_name, last_name, quantity, seating_code, seating_table, created_at, guest_names')
    .eq('event_id', eventId).eq('status', 'paid').order('created_at', { ascending: true })
  if (error) { reportError('draft seating: could not read bookings', error.message); return null }
  const byKey = new Map<string, Reg[]>()
  for (const r of (data || []) as Reg[]) {
    const key = r.seating_code || soloKey(r.id)
    byKey.set(key, [...(byKey.get(key) || []), r])
  }
  return Array.from(byKey.entries()).map(([key, list]) => ({
    key,
    code: key.startsWith('_solo_') ? null : key,
    name: `${list[0].first_name} ${list[0].last_name || ''}`.trim(),
    headcount: list.reduce((s, r) => s + (r.quantity || 1), 0),
    names: list.flatMap(r => [`${r.first_name} ${r.last_name || ''}`.trim(), ...guestNames(r)]).filter(Boolean),
    live: (list.find(r => r.seating_table && r.seating_table.length)?.seating_table || []).slice().sort((a, b) => a - b),
  }))
}

// First-fit-decreasing, the same rule Auto-assign uses on live seating.
function autoAssign(groups: { key: string; headcount: number }[], tableCount: number, seats: number): Record<string, number[]> {
  const left = Array(tableCount).fill(seats)
  const out: Record<string, number[]> = {}
  for (const g of [...groups].sort((a, b) => b.headcount - a.headcount)) {
    if (g.headcount > seats) continue
    const i = left.findIndex(r => r >= g.headcount)
    if (i === -1) continue
    left[i] -= g.headcount
    out[g.key] = [i + 1]
  }
  return out
}

function cleanAssignments(raw: unknown, groupKeys: Set<string>, tableCount: number): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!groupKeys.has(k) || !Array.isArray(v)) continue
    const t = Array.from(new Set(v.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= tableCount)))
    if (t.length) out[k] = t
  }
  return out
}

function leaseOf(ev: EventRow, me: string | null) {
  const active = !!ev.seating_edit_until && new Date(ev.seating_edit_until).getTime() > Date.now()
  return { active, mine: active && !!me && ev.seating_edit_by === me, name: active ? ev.seating_edit_name : null }
}

export async function GET(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const eventId = req.nextUrl.searchParams.get('eventId') || ''
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  const res = await loadEvent(eventId)
  if ('missing' in res) return NextResponse.json({ available: false, reason: 'not_set_up' })
  if ('failed' in res) return NextResponse.json({ error: 'Could not load the draft.' }, { status: 503 })
  const ev = res.event
  if (!ev) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (!ev.seating_enabled || !ev.table_count || !ev.seats_per_table) return NextResponse.json({ available: false, reason: 'seating_not_configured' })

  const groups = await loadGroups(eventId)
  if (!groups) return NextResponse.json({ error: 'Could not load the bookings.' }, { status: 503 })
  const keys = new Set(groups.map(g => g.key))
  const stored = ev.seating_draft?.assignments || {}
  const assignments = cleanAssignments(stored, keys, ev.table_count)
  const dropped = Object.keys(stored).filter(k => !keys.has(k))
  const me = await who(req, req.nextUrl.searchParams.get('clientId'))
  const sold = groups.reduce((s, g) => s + g.headcount, 0)
  const days = Math.ceil((new Date(ev.event_date).getTime() - Date.now()) / 86400000)
  return NextResponse.json({
    available: true,
    title: ev.title,
    tableCount: ev.table_count,
    seatsPerTable: ev.seats_per_table,
    locked: !!ev.seating_locked_at,
    groups,
    assignments,
    droppedKeys: dropped,
    hasDraft: !!ev.seating_draft,
    updatedAt: ev.seating_draft_updated_at,
    lastCommit: ev.seating_last_commit ? { at: ev.seating_last_commit.at ?? null } : null,
    lease: leaseOf(ev, me),
    nudge: {
      soldOut: ev.capacity_limit != null && sold >= ev.capacity_limit,
      daysToEvent: days >= 0 ? days : null,
    },
  })
}

export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const eventId = typeof body?.eventId === 'string' ? body.eventId : ''
  const action = body?.action
  const expected = typeof body?.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : null
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  const res = await loadEvent(eventId)
  if ('missing' in res) return NextResponse.json({ error: 'Draft seating has not been switched on yet (one database update is needed).' }, { status: 409 })
  if ('failed' in res) return NextResponse.json({ error: 'Please try again.' }, { status: 503 })
  const ev = res.event
  if (!ev) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (!ev.seating_enabled || !ev.table_count || !ev.seats_per_table) return NextResponse.json({ error: 'Set the number of tables and seats per table first.' }, { status: 400 })
  if (ev.seating_locked_at) return NextResponse.json({ error: 'Seating is locked. Unlock it in the list view to change anything.' }, { status: 409 })

  const me = await who(req, body?.clientId)
  if (!leaseOf(ev, me).mine) {
    const l = leaseOf(ev, me)
    return NextResponse.json({ error: l.active ? `${l.name} is editing right now.` : 'Press Edit first, so only one person changes the seating at a time.', leaseLost: true }, { status: 409 })
  }

  const groups = await loadGroups(eventId)
  if (!groups) return NextResponse.json({ error: 'Could not load the bookings.' }, { status: 503 })
  const keys = new Set(groups.map(g => g.key))
  const current = cleanAssignments(ev.seating_draft?.assignments, keys, ev.table_count)

  // ---- Commit and undo: the only writes to bookings -----------------------
  if (action === 'commit') {
    const lock = body?.lock === true
    // Commit exactly what the person was looking at: if the draft has changed
    // since they loaded it (someone else edited, or bookings moved the groups
    // about), refuse and make them look again rather than commit a surprise.
    if (expected !== null && Number.isNaN(Date.parse(expected))) {
      return NextResponse.json({ error: 'The draft changed since you loaded it. Reload and check before committing.', conflict: true }, { status: 409 })
    }
    const { data, error } = await supabaseAdmin.rpc('commit_seating_draft', {
      p_event_id: eventId, p_assignments: current, p_expected: expected, p_lock: lock,
    })
    if (error) return rpcFailure(error.message, 'commit')
    return NextResponse.json({ ok: true, ...(data as object) })
  }
  if (action === 'undo_commit') {
    const { data, error } = await supabaseAdmin.rpc('undo_seating_commit', { p_event_id: eventId })
    if (error) return rpcFailure(error.message, 'undo')
    return NextResponse.json({ ok: true, ...(data as object) })
  }

  // ---- Draft edits: write only the draft columns --------------------------
  let next: Record<string, number[]>
  if (action === 'set') {
    const key = typeof body.groupKey === 'string' ? body.groupKey : ''
    if (!keys.has(key)) return NextResponse.json({ error: 'That group no longer exists. Reload.' }, { status: 404 })
    const tables = Array.isArray(body.tables) ? Array.from(new Set(body.tables.map(Number).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= ev.table_count!))) : []
    next = { ...current }
    if (tables.length) next[key] = tables as number[]; else delete next[key]
  } else if (action === 'copy_live') {
    next = {}
    for (const g of groups) if (g.live.length) next[g.key] = g.live.filter(n => n >= 1 && n <= ev.table_count!)
  } else if (action === 'auto_assign') {
    next = autoAssign(groups, ev.table_count, ev.seats_per_table)
  } else if (action === 'clear') {
    next = {}
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  const updatedAt = new Date().toISOString()
  let q = supabaseAdmin.from('events').update({ seating_draft: { version: 1, assignments: next }, seating_draft_updated_at: updatedAt }).eq('id', eventId)
  q = expected === null ? q.is('seating_draft_updated_at', null) : q.eq('seating_draft_updated_at', expected)
  const { data, error } = await q.select('id')
  if (error) { reportError('draft seating: could not save the draft', error.message); return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 }) }
  if (!data || data.length !== 1) return NextResponse.json({ error: 'The draft changed since you loaded it. Reload to see the latest.', conflict: true }, { status: 409 })
  return NextResponse.json({ ok: true, updatedAt, assignments: next })
}

function rpcFailure(m: string, what: string) {
  if (/conflict/.test(m)) return NextResponse.json({ error: 'The draft changed since you loaded it. Reload and check before committing.', conflict: true }, { status: 409 })
  if (/locked/.test(m)) return NextResponse.json({ error: 'Seating is locked.' }, { status: 409 })
  if (/nothing_to_undo/.test(m)) return NextResponse.json({ error: 'There is no commit to undo.' }, { status: 400 })
  if (/bad_assignments/.test(m)) return NextResponse.json({ error: 'The draft is not valid. Reload and try again.' }, { status: 400 })
  reportError(`draft seating: ${what} failed`, m)
  return NextResponse.json({ error: `Could not ${what}. Nothing was changed.` }, { status: 500 })
}
