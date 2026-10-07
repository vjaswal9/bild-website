'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Laptop, Lock, Pencil, Wand2, Copy, Eraser, Undo2, CheckCircle2, Info } from 'lucide-react'
import { FloorLayout, seatSlots, tableBody, footprint, SEAT_R } from '@/lib/floor-plan'

type Group = { key: string; code: string | null; name: string; headcount: number; names: string[]; live: number[] }
type Draft = {
  available: boolean; title: string; tableCount: number; seatsPerTable: number; locked: boolean
  groups: Group[]; assignments: Record<string, number[]>; droppedKeys: string[]; hasDraft: boolean
  updatedAt: string | null; lastCommit: { at: string | null } | null
  lease: { active: boolean; mine: boolean; name: string | null }
  nudge: { soldOut: boolean; daysToEvent: number | null }
}

const API = '/api/admin/events/seating-draft'
const LAYOUT_API = '/api/admin/events/seating-layout'
// Twelve distinguishable colours (a colour-blind friendly set); one per group.
const COLOURS = ['#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#B07AA1', '#76B7B2', '#EDC948', '#FF9DA7', '#9C755F', '#BAB0AC', '#86BCB6', '#D37295']
const colourOf = (key: string) => { let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; return COLOURS[h % COLOURS.length] }

function tabId(): string {
  try { let id = sessionStorage.getItem('bild_plan_tab'); if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('bild_plan_tab', id) } return id }
  catch { return 'tab-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36) }
}

// How many of a group's people sit at each of its tables: filled in order,
// one table's worth at a time, the rest on the next.
function seatsByTable(g: Group, tables: number[], seats: number): Record<number, number> {
  const out: Record<number, number> = {}
  let left = g.headcount
  const sorted = [...tables].sort((a, b) => a - b)
  sorted.forEach((n, i) => { const take = i === sorted.length - 1 ? left : Math.min(seats, left); out[n] = take; left -= take })
  return out
}

// Draft seating: plan who sits where WITHOUT touching any booking. Nothing here
// changes live seating until "Commit" is pressed and confirmed.
export default function DraftSeating({ eventId }: { eventId: string }) {
  const [d, setD] = useState<Draft | null>(null)
  const [layout, setLayout] = useState<FloorLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [lost, setLost] = useState(false)
  const [view, setView] = useState<'draft' | 'live'>('draft')
  const [sel, setSel] = useState<string | null>(null)
  const [selTable, setSelTable] = useState<number | null>(null)
  const [carry, setCarry] = useState<string | null>(null)
  const [commitOpen, setCommitOpen] = useState(false)
  const [small, setSmall] = useState(false)
  const [clientId] = useState(tabId)
  const svgRef = useRef<SVGSVGElement>(null)
  const carryRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch(`${API}?eventId=${eventId}&clientId=${clientId}`).then(r => r.json()),
        fetch(`${LAYOUT_API}?eventId=${eventId}&clientId=${clientId}`).then(r => r.json()),
      ])
      if (a.error) { setError(a.error); setLoading(false); return }
      setD(a); if (b.layout) setLayout(b.layout)
      if (!a.lease?.mine) setEditing(false)
    } catch { setError('Network error loading the draft.') }
    setLoading(false)
  }, [eventId, clientId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const check = () => setSmall(window.innerWidth < 1024 || window.matchMedia('(pointer: coarse)').matches)
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])
  // Keep looking in step with other admins while only viewing.
  useEffect(() => {
    if (editing) return
    const t = setInterval(load, 20000); return () => clearInterval(t)
  }, [editing, load])
  // Keep the editing claim alive; stop if somebody takes over.
  useEffect(() => {
    if (!editing) return
    const t = setInterval(async () => {
      try {
        const r = await fetch(LAYOUT_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'heartbeat', eventId, clientId }) })
        if (r.status === 409) { setEditing(false); setLost(true) }
      } catch { /* the claim lasts two minutes */ }
    }, 30000)
    return () => clearInterval(t)
  }, [editing, eventId, clientId])
  useEffect(() => {
    if (!editing) return
    const release = () => { fetch(LAYOUT_API, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release', eventId, clientId }) }).catch(() => {}) }
    window.addEventListener('pagehide', release)
    return () => { window.removeEventListener('pagehide', release); release() }
  }, [editing, eventId, clientId])

  const seats = d?.seatsPerTable ?? 8
  const assignments = useMemo<Record<string, number[]>>(
    () => (view === 'draft' ? d?.assignments : Object.fromEntries((d?.groups || []).filter(g => g.live.length).map(g => [g.key, g.live]))) || {},
    [view, d],
  )
  const canEdit = !!d && editing && view === 'draft' && !d.locked && !small && !lost

  // Seat dots per table: [colour, group] in fill order, plus how many are over.
  const tables = useMemo(() => {
    const out: Record<number, { fills: { key: string; n: number }[]; used: number }> = {}
    for (let n = 1; n <= (d?.tableCount ?? 0); n++) out[n] = { fills: [], used: 0 }
    for (const g of d?.groups || []) {
      const t = assignments[g.key]; if (!t?.length) continue
      const per = seatsByTable(g, t, seats)
      for (const n of t) if (out[n]) { out[n].fills.push({ key: g.key, n: per[n] || 0 }); out[n].used += per[n] || 0 }
    }
    return out
  }, [d, assignments, seats])

  const unseated = (d?.groups || []).filter(g => !(assignments[g.key]?.length))
  const groupBy = (k: string) => d?.groups.find(g => g.key === k)

  async function act(body: Record<string, unknown>, okNote?: string) {
    if (!d) return null
    setBusy(true); setError(''); setNotice('')
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, clientId, expectedUpdatedAt: d.updatedAt, ...body }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(j.error || 'Something went wrong.')
        if (j.leaseLost) { setEditing(false); setLost(true) }
        if (j.conflict) await load()
        setBusy(false); return null
      }
      if (okNote) setNotice(okNote)
      if (j.assignments) setD(prev => prev ? { ...prev, assignments: j.assignments, updatedAt: j.updatedAt, hasDraft: true } : prev)
      setBusy(false); return j
    } catch { setError('Network error. Nothing was changed.'); setBusy(false); return null }
  }

  async function startEditing(takeover = false) {
    if (takeover && !confirm(`${d?.lease.name || 'Another admin'} is editing. If you take over, their unsaved work is lost. Take over?`)) return
    setError('')
    const r = await fetch(LAYOUT_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim', eventId, clientId, takeover }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setError(j.error || 'Could not start editing.'); await load(); return }
    setLost(false); await load(); setEditing(true)
  }
  async function stopEditing() {
    setEditing(false); setCommitOpen(false); setSel(null)
    await fetch(LAYOUT_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release', eventId, clientId }) }).catch(() => {})
    await load()
  }

  async function assign(key: string, n: number) {
    const g = groupBy(key); if (!g || !d) return
    const free = seats - (tables[n]?.used ?? 0)
    const already = assignments[key]?.includes(n)
    if (already) return
    if (g.headcount <= seats && g.headcount > free && !confirm(`Only ${Math.max(free, 0)} seat${free === 1 ? '' : 's'} free at table ${n}, and this group is ${g.headcount}. Seat them there anyway?`)) return
    const cur = assignments[key] || []
    const next = g.headcount > seats ? Array.from(new Set([...cur, n])) : [n]
    await act({ action: 'set', groupKey: key, tables: next }, `${g.name} (${g.headcount}) is at table ${n} in the draft.`)
    setSel(null)
  }
  async function unseat(key: string, n: number) {
    const cur = assignments[key] || []
    await act({ action: 'set', groupKey: key, tables: cur.filter(x => x !== n) })
  }

  // Dragging a group from the list onto a table.
  useEffect(() => {
    if (!carry) return
    carryRef.current = carry
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-table]')
      const n = el ? Number(el.getAttribute('data-table')) : NaN
      const key = carryRef.current; carryRef.current = null; setCarry(null)
      if (key && Number.isInteger(n)) assign(key, n)
    }
    window.addEventListener('pointerup', up, { once: true })
    return () => window.removeEventListener('pointerup', up)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carry])

  // The commit preview: live now vs the draft.
  const diff = useMemo(() => {
    const out = { placed: [] as Group[], moved: [] as Group[], unseated: [] as Group[], same: 0 }
    for (const g of d?.groups || []) {
      const dr = d?.assignments[g.key] || [], lv = g.live
      const eq = dr.length === lv.length && [...dr].sort((a, b) => a - b).every((v, i) => v === [...lv].sort((a, b) => a - b)[i])
      if (eq) out.same++
      else if (!lv.length) out.placed.push(g)
      else if (!dr.length) out.unseated.push(g)
      else out.moved.push(g)
    }
    return out
  }, [d])
  const overfull = Object.entries(tables).filter(([, t]) => t.used > seats).length

  async function commit(lock: boolean) {
    if (lock && !confirm('Commit the draft AND lock seating? Nothing can change until you unlock it.')) return
    const j = await act({ action: 'commit', lock })
    if (j) { setCommitOpen(false); await load(); setNotice(`Committed. ${j.bookingsChanged} booking${j.bookingsChanged === 1 ? '' : 's'} updated${lock ? ' and seating locked' : ''}. You can undo the last commit until you lock.`) }
  }
  async function undoCommit() {
    if (!confirm('Put live seating back exactly as it was before the last commit?')) return
    const j = await act({ action: 'undo_commit' })
    if (j) { await load(); setNotice(`Live seating restored. ${j.bookingsChanged} booking${j.bookingsChanged === 1 ? '' : 's'} put back.`) }
  }

  if (loading) return <div className="px-6 py-8 text-center"><Loader2 className="animate-spin inline" size={20} /></div>
  if (!d || !d.available || !layout) return <div className="px-6 py-5"><p className="text-gray-400 text-sm">{error || 'Draft seating is not available for this event yet.'}</p></div>

  const btn = 'inline-flex items-center gap-1.5 border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed'
  const primary = 'inline-flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40'
  const nudge = d.nudge.soldOut ? 'Sold out. Ready to commit the seating?' : d.nudge.daysToEvent !== null && d.nudge.daysToEvent <= 7 ? `The event is ${d.nudge.daysToEvent === 0 ? 'today' : d.nudge.daysToEvent === 1 ? 'tomorrow' : `in ${d.nudge.daysToEvent} days`}. Ready to commit the seating?` : ''
  const tablesAt = selTable ? (d.groups || []).filter(g => assignments[g.key]?.includes(selTable)) : []

  return (
    <div className="px-6 py-5 space-y-3">
      <div className="flex gap-2 items-start rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        <Laptop size={18} className="shrink-0 mt-0.5" /><span>Do this on a laptop or desktop. Dragging does not work reliably on phones or tablets.</span>
      </div>
      <div className="flex gap-2 items-start rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-gray-300">
        <Info size={16} className="shrink-0 mt-0.5" />
        <span>{view === 'draft' ? 'This is a DRAFT. Nothing here changes the real seating, the door list or any booking until you commit it.' : 'This is the LIVE seating (read only): what the door list and exports use today.'}</span>
      </div>
      {d.locked && <div className="flex gap-2 items-start rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-gray-300"><Lock size={16} className="shrink-0 mt-0.5" /><span>Seating is locked, so nothing can change. Unlock it in the list view first.</span></div>}
      {nudge && !d.locked && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gold-500/50 bg-gold-500/10 px-3 py-2 text-sm text-gold-200">
          <span>{nudge}</span>
          <button type="button" className={`${btn} ml-auto`} onClick={() => { setView('draft'); setCommitOpen(true) }}>Review and commit</button>
        </div>
      )}

      {!d.locked && !small && (
        editing ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-200">
            <Pencil size={16} /><span>You are editing the draft. Others see it as view only.</span>
            <button type="button" onClick={stopEditing} className="ml-auto border border-green-400/50 rounded-lg px-3 py-1 text-xs">Done editing</button>
          </div>
        ) : lost ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"><span>Another admin has taken over editing.</span>
            <button type="button" onClick={() => { setLost(false); load() }} className="ml-auto border border-red-400/50 rounded-lg px-3 py-1 text-xs">Reload</button></div>
        ) : d.lease.active && !d.lease.mine ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"><Lock size={16} /><span>{d.lease.name} is editing. View only for now.</span>
            <button type="button" onClick={() => startEditing(true)} className="ml-auto border border-amber-400/50 rounded-lg px-3 py-1 text-xs">Take over editing</button></div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-gray-300"><span>View only. Press Edit to change the draft; while you do, nobody else can edit.</span>
            <button type="button" onClick={() => startEditing(false)} className={`${primary} ml-auto`}><Pencil size={14} /> Edit draft</button></div>
        )
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex border border-charcoal-600 rounded-lg overflow-hidden text-xs" role="group" aria-label="Which seating to show">
          <button type="button" className={`px-3 py-1.5 ${view === 'draft' ? 'bg-gold-500 text-white' : 'text-gray-300'}`} onClick={() => setView('draft')}>Draft</button>
          <button type="button" className={`px-3 py-1.5 ${view === 'live' ? 'bg-gold-500 text-white' : 'text-gray-300'}`} onClick={() => setView('live')}>Live</button>
        </div>
        <button type="button" className={btn} disabled={!canEdit || busy} onClick={() => act({ action: 'copy_live' }, 'Live seating copied into the draft.')}><Copy size={14} /> Copy live into draft</button>
        <button type="button" className={btn} disabled={!canEdit || busy} onClick={() => { if (!d.hasDraft || Object.keys(d.assignments).length === 0 || confirm('Replace the draft with a fresh automatic arrangement?')) act({ action: 'auto_assign' }, 'Draft filled by auto-assign. Nothing live changed.') }}><Wand2 size={14} /> Auto-assign into draft</button>
        <button type="button" className={btn} disabled={!canEdit || busy || Object.keys(d.assignments).length === 0} onClick={() => { if (confirm('Clear the whole draft? Live seating is not affected.')) act({ action: 'clear' }, 'Draft cleared.') }}><Eraser size={14} /> Clear draft</button>
        <span className="ml-auto" />
        {d.lastCommit && <button type="button" className={btn} disabled={!editing || busy || d.locked} onClick={undoCommit}><Undo2 size={14} /> Undo last commit</button>}
        <button type="button" className={primary} disabled={!canEdit || busy} onClick={() => setCommitOpen(o => !o)}><CheckCircle2 size={14} /> Commit...</button>
      </div>

      {commitOpen && (
        <div className="rounded-lg border border-gold-500/50 bg-gold-500/5 p-3 space-y-2 text-sm text-gray-200">
          <p className="font-medium">What committing will do to LIVE seating</p>
          <ul className="list-disc ml-5 space-y-0.5">
            <li>{diff.placed.length} group{diff.placed.length === 1 ? '' : 's'} newly seated{diff.placed.length ? `: ${diff.placed.slice(0, 8).map(g => g.name).join(', ')}${diff.placed.length > 8 ? ', ...' : ''}` : ''}</li>
            <li>{diff.moved.length} group{diff.moved.length === 1 ? '' : 's'} moved{diff.moved.length ? `: ${diff.moved.slice(0, 8).map(g => g.name).join(', ')}${diff.moved.length > 8 ? ', ...' : ''}` : ''}</li>
            <li className={diff.unseated.length ? 'text-amber-200' : ''}>{diff.unseated.length} group{diff.unseated.length === 1 ? '' : 's'} would become UNSEATED{diff.unseated.length ? `: ${diff.unseated.slice(0, 8).map(g => g.name).join(', ')}${diff.unseated.length > 8 ? ', ...' : ''}` : ''}</li>
            <li>{diff.same} unchanged</li>
          </ul>
          {unseated.length > 0 && <p className="text-amber-200">{unseated.length} group{unseated.length === 1 ? ' is' : 's are'} not seated in the draft, so they will have no table after this.</p>}
          {overfull > 0 && <p className="text-red-300">{overfull} table{overfull === 1 ? ' has' : 's have'} more people than seats.</p>}
          <p className="text-gray-400">Live seating will match the draft exactly. You can undo the last commit with one click, until you lock.</p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={primary} disabled={busy} onClick={() => commit(false)}>{busy ? 'Committing...' : 'Commit to live seating'}</button>
            <button type="button" className={primary} disabled={busy} onClick={() => commit(true)}>Commit and lock</button>
            <button type="button" className={btn} onClick={() => setCommitOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {notice && <p className="text-green-300 text-sm">{notice}</p>}
      {d.droppedKeys.length > 0 && <p className="text-amber-200 text-sm">{d.droppedKeys.length} group{d.droppedKeys.length === 1 ? '' : 's'} in the draft no longer exist (cancelled or merged) and were left out.</p>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px] items-start">
        <svg ref={svgRef} viewBox={`0 0 ${layout.room.w} ${layout.room.h}`} width="100%" role="application" aria-label="Seating plan" className="block rounded-lg border border-charcoal-600 bg-[#242424] select-none touch-none" style={{ aspectRatio: `${layout.room.w} / ${layout.room.h}` }}>
          {layout.labels.map(l => (
            <g key={l.id}><rect x={l.x} y={l.y} width={l.w} height={l.h} rx={8} fill="#33302a" stroke="#7a7568" strokeWidth={2} />
              <text x={l.x + l.w / 2} y={l.y + l.h / 2} textAnchor="middle" dominantBaseline="central" fill="#d6d2c4" fontSize={Math.min(34, Math.max(20, l.h * 0.4))} fontFamily="sans-serif">{l.text}</text></g>
          ))}
          {layout.tables.map(t => {
            const body = tableBody(t.shape, seats), slots = seatSlots(t.shape, seats), f = footprint(t, seats)
            const info = tables[t.n] || { fills: [], used: 0 }
            const over = info.used > seats, free = seats - info.used
            const dots: string[] = []
            info.fills.forEach(fl => { for (let i = 0; i < fl.n; i++) dots.push(fl.key) })
            const on = selTable === t.n
            return (
              <g key={t.n} data-table={t.n} role="button" aria-label={`Table ${t.n}, ${info.used} of ${seats} seats`} style={{ cursor: 'pointer' }}
                onPointerDown={e => { e.stopPropagation(); if (sel && canEdit) { assign(sel, t.n) } else { setSelTable(on ? null : t.n) } }}>
                <rect data-table={t.n} x={t.x - f.w / 2} y={t.y - f.h / 2} width={f.w} height={f.h} fill="transparent" />
                <g transform={`translate(${t.x} ${t.y}) rotate(${t.rot})`}>
                  {t.shape === 'round'
                    ? <circle r={body.w / 2} fill="#2e2e2e" stroke={over ? '#e06c6c' : on ? '#f3d58a' : '#666'} strokeWidth={over || on ? 5 : 2} />
                    : <rect x={-body.w / 2} y={-body.h / 2} width={body.w} height={body.h} rx={8} fill="#2e2e2e" stroke={over ? '#e06c6c' : on ? '#f3d58a' : '#666'} strokeWidth={over || on ? 5 : 2} />}
                  {slots.map((s, i) => dots[i]
                    ? <circle key={i} cx={s.dx} cy={s.dy} r={SEAT_R} fill={colourOf(dots[i])} />
                    : <circle key={i} cx={s.dx} cy={s.dy} r={SEAT_R} fill="none" stroke="#8a8a8a" strokeWidth={2.5} />)}
                </g>
                <text x={t.x} y={t.y - 6} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={30} fontFamily="sans-serif" fontWeight={600}>{t.n}</text>
                <text x={t.x} y={t.y + 20} textAnchor="middle" dominantBaseline="central" fill={over ? '#f08a8a' : '#9a9890'} fontSize={18} fontFamily="sans-serif">{over ? `${info.used - seats} over` : free === 0 ? 'full' : `${free} free`}</text>
              </g>
            )
          })}
        </svg>

        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-gray-200 mb-1">Not yet seated ({unseated.length})</p>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {unseated.map(g => (
                <div key={g.key} role="button" tabIndex={0}
                  onPointerDown={e => { if (!canEdit) return; e.preventDefault(); setSel(g.key); setSelTable(null); setCarry(g.key) }}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${sel === g.key ? 'border-gold-400 bg-gold-500/10' : 'border-dashed border-charcoal-500'} ${canEdit ? 'cursor-grab' : 'opacity-70'}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colourOf(g.key) }} />
                  <span className="flex-1">{g.name} <span className="text-gray-400">x{g.headcount}{g.code ? ` (${g.code})` : ''}</span></span>
                </div>
              ))}
              {unseated.length === 0 && <p className="text-xs text-gray-500">Everyone has a table.</p>}
            </div>
            {canEdit && <p className="text-xs text-gray-500 mt-1">Drag a group onto a table, or click a group then a table.{sel ? ' Now click a table.' : ''}</p>}
          </div>
          {selTable && (
            <div className="border-t border-charcoal-700 pt-2">
              <p className="font-medium text-gray-200 mb-1">Table {selTable} ({tables[selTable]?.used ?? 0} of {seats})</p>
              {tablesAt.length === 0 && <p className="text-xs text-gray-500">Empty.</p>}
              {tablesAt.map(g => (
                <div key={g.key} className="mb-2">
                  <p className="flex items-center gap-2 text-xs"><span className="w-2.5 h-2.5 rounded-full" style={{ background: colourOf(g.key) }} />{g.name} <span className="text-gray-400">x{g.headcount}</span></p>
                  <p className="text-xs text-gray-400 ml-4">{g.names.join(', ')}</p>
                  {canEdit && <div className="ml-4 mt-1 flex gap-2">
                    <button type="button" className={btn} onClick={() => { setSel(g.key); setSelTable(null); setNotice(`Click the table to move ${g.name} to.`) }}>Move</button>
                    <button type="button" className={btn} onClick={() => unseat(g.key, selTable)}>Remove</button>
                  </div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
