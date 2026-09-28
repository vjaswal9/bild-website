import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { generateSeatingCode, normalizeSeatingCode } from '@/lib/seating-code'

export const dynamic = 'force-dynamic'

function authed(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

// A "group" for seating purposes is every paid booking sharing a seating_code,
// or - for a booking with no code - that booking on its own. Both cases use
// the same key so every action below (merge, set table, auto-assign) can treat
// a solo booking exactly like a group of one, with no special-casing.
const soloKey = (id: string) => `_solo_${id}`
const isSolo = (key: string) => key.startsWith('_solo_')
const soloId = (key: string) => key.slice('_solo_'.length)

type Reg = {
  id: string
  first_name: string
  last_name: string | null
  quantity: number | null
  seating_code: string | null
  seating_table: number | null
  created_at: string
}

function groupRegs(regs: Reg[]) {
  const byKey = new Map<string, Reg[]>()
  for (const r of regs) {
    const key = r.seating_code || soloKey(r.id)
    const list = byKey.get(key)
    if (list) list.push(r)
    else byKey.set(key, [r])
  }
  return byKey
}

// GET: the grouped view the Seating panel renders.
export async function GET(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const { data: event, error: eventErr } = await supabaseAdmin
    .from('events')
    .select('seating_enabled, table_count, seats_per_table, seating_locked_at')
    .eq('id', eventId)
    .maybeSingle()
  if (eventErr || !event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

  const { data: regs, error: regsErr } = await supabaseAdmin
    .from('event_registrations')
    .select('id, first_name, last_name, quantity, seating_code, seating_table, created_at')
    .eq('event_id', eventId)
    .eq('status', 'paid')
    .order('created_at', { ascending: true })
  if (regsErr) return NextResponse.json({ error: regsErr.message }, { status: 500 })

  const byKey = groupRegs((regs || []) as Reg[])
  const seatsPerTable = event.seats_per_table as number | null

  const groups = Array.from(byKey.entries()).map(([key, list]) => {
    const headcount = list.reduce((s, r) => s + (r.quantity || 1), 0)
    // Whoever booked first under this code is who friends would name it after.
    const organiser = list[0]
    const tables = new Set(list.map(r => r.seating_table).filter(t => t != null))
    return {
      key,
      code: isSolo(key) ? null : key,
      organiserName: `${organiser.first_name} ${organiser.last_name || ''}`.trim(),
      headcount,
      oversized: seatsPerTable != null && headcount > seatsPerTable,
      // More than one distinct table means a merge happened after tables were
      // assigned and this group has never been re-placed - shown as
      // unassigned rather than picking one arbitrarily.
      table: tables.size === 1 ? Array.from(tables)[0] : null,
      bookings: list.map(r => ({ id: r.id, name: `${r.first_name} ${r.last_name || ''}`.trim(), quantity: r.quantity || 1 })),
    }
  })
  groups.sort((a, b) => b.headcount - a.headcount)

  const totalHeadcount = groups.reduce((s, g) => s + g.headcount, 0)
  const totalCapacity = event.table_count != null && seatsPerTable != null ? event.table_count * seatsPerTable : null

  return NextResponse.json({
    seatingEnabled: event.seating_enabled,
    tableCount: event.table_count,
    seatsPerTable,
    locked: !!event.seating_locked_at,
    lockedAt: event.seating_locked_at,
    totalHeadcount,
    totalCapacity,
    groups,
  })
}

async function requireUnlocked(eventId: string) {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('seating_locked_at')
    .eq('id', eventId)
    .maybeSingle()
  return !event?.seating_locked_at
}

export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const b = await req.json().catch(() => null)
  const eventId = b?.eventId
  if (!eventId || !b?.action) return NextResponse.json({ error: 'Missing eventId or action.' }, { status: 400 })

  if (b.action === 'lock' || b.action === 'unlock') {
    const { error } = await supabaseAdmin
      .from('events')
      .update({ seating_locked_at: b.action === 'lock' ? new Date().toISOString() : null })
      .eq('id', eventId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Every other action changes the plan, so it is blocked once locked - the
  // whole point of locking is that the door list, once printed, does not move
  // again without someone deliberately unlocking first.
  if (!(await requireUnlocked(eventId))) {
    return NextResponse.json({ error: 'Seating is locked for this event. Unlock it first to make changes.' }, { status: 409 })
  }

  if (b.action === 'set_table') {
    // groupKey identifies a merged code or a single solo booking - see soloKey.
    const { groupKey, table } = b
    if (!groupKey) return NextResponse.json({ error: 'Missing groupKey.' }, { status: 400 })
    const tableNum = table === null || table === '' ? null : Math.max(1, Math.round(Number(table)))
    const query = supabaseAdmin.from('event_registrations').update({ seating_table: tableNum }).eq('event_id', eventId)
    const { error } = isSolo(groupKey)
      ? await query.eq('id', soloId(groupKey))
      : await query.eq('seating_code', groupKey)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (b.action === 'set_code') {
    // Merges one or more groups into a single code. Table assignments on the
    // moved bookings are cleared: a merge changes who is in the party, so a
    // table chosen for the smaller, separate parties is no longer meaningful
    // and re-placing it is a decision, not something to guess at silently.
    const { groupKeys } = b
    if (!Array.isArray(groupKeys) || groupKeys.length === 0) {
      return NextResponse.json({ error: 'Select at least one booking to move.' }, { status: 400 })
    }
    const targetCode = b.code === 'NEW' ? generateSeatingCode() : normalizeSeatingCode(b.code)
    if (!targetCode) return NextResponse.json({ error: 'Missing destination code.' }, { status: 400 })

    for (const key of groupKeys) {
      const query = supabaseAdmin
        .from('event_registrations')
        .update({ seating_code: targetCode, seating_table: null })
        .eq('event_id', eventId)
      const { error } = isSolo(key) ? await query.eq('id', soloId(key)) : await query.eq('seating_code', key)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, code: targetCode })
  }

  if (b.action === 'auto_assign') {
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('table_count, seats_per_table')
      .eq('id', eventId)
      .maybeSingle()
    const tableCount = event?.table_count as number | null
    const seatsPerTable = event?.seats_per_table as number | null
    if (!tableCount || !seatsPerTable) {
      return NextResponse.json({ error: 'Set the number of tables and seats per table first.' }, { status: 400 })
    }

    const { data: regs, error: regsErr } = await supabaseAdmin
      .from('event_registrations')
      .select('id, first_name, last_name, quantity, seating_code, seating_table, created_at')
      .eq('event_id', eventId)
      .eq('status', 'paid')
    if (regsErr) return NextResponse.json({ error: regsErr.message }, { status: 500 })

    const byKey = groupRegs((regs || []) as Reg[])
    const groups = Array.from(byKey.entries()).map(([key, list]) => ({
      key,
      ids: list.map(r => r.id),
      headcount: list.reduce((s, r) => s + (r.quantity || 1), 0),
      name: `${list[0].first_name} ${list[0].last_name || ''}`.trim(),
    }))
    // Largest first: a greedy first-fit-decreasing bin pack. Not an optimal
    // packer, but tables of eight to ten at a community dinner do not need one
    // - the only thing that matters is that it tells the truth about what
    // does not fit, rather than silently cramming people in.
    groups.sort((a, b2) => b2.headcount - a.headcount)

    const remaining = Array(tableCount).fill(seatsPerTable)
    const placements: { ids: string[]; table: number }[] = []
    const unplaced: { key: string; name: string; headcount: number; oversized: boolean }[] = []

    for (const g of groups) {
      if (g.headcount > seatsPerTable) {
        unplaced.push({ key: g.key, name: g.name, headcount: g.headcount, oversized: true })
        continue
      }
      const tableIdx = remaining.findIndex(r => r >= g.headcount)
      if (tableIdx === -1) {
        unplaced.push({ key: g.key, name: g.name, headcount: g.headcount, oversized: false })
        continue
      }
      remaining[tableIdx] -= g.headcount
      placements.push({ ids: g.ids, table: tableIdx + 1 })
    }

    // A fresh computation every time: clear every assignment, then write the
    // new one. Running Auto-assign a second time after manual tweaks is a
    // deliberate "start over", not an incremental fix on top of them.
    const { error: clearErr } = await supabaseAdmin
      .from('event_registrations')
      .update({ seating_table: null })
      .eq('event_id', eventId)
      .eq('status', 'paid')
    if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 })

    for (const p of placements) {
      const { error } = await supabaseAdmin
        .from('event_registrations')
        .update({ seating_table: p.table })
        .in('id', p.ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      placedGroups: placements.length,
      unplaced,
    })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
