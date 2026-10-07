'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Laptop, Lock, Plus, Copy, RotateCw, Trash2, Save, ArrowLeftRight, Undo2, Pencil } from 'lucide-react'
import {
  FloorLayout, PlanTable, PlanLabel, TableShape,
  seatSlots, tableBody, footprint, clampTable, snap, GRID, SEAT_R, MAX_LABELS, MAX_LABEL_TEXT,
  swapMapping, autoNumberMapping, isIdentity, type AutoOrder, type Mapping,
} from '@/lib/floor-plan'

type Lease = { supported: boolean; active: boolean; mine: boolean; name: string | null; since: string | null; until: string | null }

type Payload = {
  available: boolean
  saved: boolean
  layout: FloorLayout
  added: number[]
  dropped: number[]
  updatedAt: string | null
  tableCount: number
  seatsPerTable: number
  locked: boolean
  lease: Lease
  toolsReady: boolean
  lastRenumber: { at: string | null; label: string } | null
}

type Selection = { type: 'table'; n: number } | { type: 'label'; id: string } | null
type Source = { id: string; title: string; eventDate: string; tableCount: number | null }

type Drag =
  | { kind: 'table'; n: number; startX: number; startY: number; origX: number; origY: number }
  | { kind: 'label'; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: 'resize'; id: string; startX: number; startY: number; origW: number; origH: number }

const API = '/api/admin/events/seating-layout'

// One id per browser tab, so two windows of the same person do not both edit.
function tabId(): string {
  try {
    let id = sessionStorage.getItem('bild_plan_tab')
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('bild_plan_tab', id) }
    return id
  } catch { return 'tab-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36) }
}

const ORDER_LABEL: Record<AutoOrder, string> = {
  rows: 'Rows, left to right, top to bottom',
  columns: 'Columns, top to bottom, left to right',
  clockwise: 'Clockwise from the top',
  anticlockwise: 'Anticlockwise from the top',
}

function clock(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : ''
}

// The room editor: arrange the tables and labels where they really are in the
// venue. Stage 1 of the floor plan - it changes the saved LAYOUT only. It never
// changes how many tables there are (that stays the event's own setting) and
// never touches a booking.
export default function FloorPlan({ eventId }: { eventId: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [layout, setLayout] = useState<FloorLayout | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [selected, setSelected] = useState<Selection>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [conflict, setConflict] = useState(false)
  const [smallScreen, setSmallScreen] = useState(false)
  const [sources, setSources] = useState<Source[] | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyFrom, setCopyFrom] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  // Snap to grid: 0 is off. Remembered per browser so it is the same next time.
  const [grid, setGridState] = useState<number>(25)
  useEffect(() => {
    try { const v = Number(localStorage.getItem('bild-plan-grid')); if ([0, 10, 25, 50].includes(v) && localStorage.getItem('bild-plan-grid') !== null) setGridState(v) } catch { /* optional */ }
  }, [])
  function setGrid(v: number) { setGridState(v); try { localStorage.setItem('bild-plan-grid', String(v)) } catch { /* optional */ } }
  const sn = (v: number) => (grid ? snap(v, grid) : Math.round(v))
  const [clientId] = useState(tabId)
  const [editing, setEditing] = useState(false)
  const [lostLease, setLostLease] = useState(false)
  const [lease, setLease] = useState<Lease | null>(null)
  const [lastRenumber, setLastRenumber] = useState<{ at: string | null; label: string } | null>(null)
  const [renum, setRenum] = useState<{ kind: 'swap'; first: number | null; second: number | null } | { kind: 'auto'; order: AutoOrder } | null>(null)
  const [seated, setSeated] = useState<{ tables: number[]; headcount: number }[] | null>(null)
  const [renumBusy, setRenumBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(''); setConflict(false)
    try {
      const res = await fetch(`${API}?eventId=${eventId}&clientId=${clientId}`)
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Could not load the floor plan.'); setLoading(false); return }
      setData(d)
      if (d.available) {
        setLayout(d.layout); setUpdatedAt(d.updatedAt); setDirty(false); setSelected(null); setRenum(null)
        setLease(d.lease); setLastRenumber(d.lastRenumber)
        if (!d.lease?.mine) setEditing(false)
        if (d.added?.length || d.dropped?.length) {
          setNotice([
            d.added?.length ? `Table${d.added.length > 1 ? 's' : ''} ${d.added.join(', ')} added to match the event's table count.` : '',
            d.dropped?.length ? `Table${d.dropped.length > 1 ? 's' : ''} ${d.dropped.join(', ')} no longer in the event, so not shown.` : '',
          ].filter(Boolean).join(' '))
        }
      }
    } catch { setError('Network error loading the floor plan.') }
    setLoading(false)
  }, [eventId, clientId])

  useEffect(() => { load() }, [load])

  // Editing needs a mouse and a real screen. Phones and tablets can look and
  // print but not edit.
  useEffect(() => {
    const check = () => setSmallScreen(window.innerWidth < 1024 || window.matchMedia('(pointer: coarse)').matches)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const leaseOk = !lease?.supported || editing
  const editable = !!data?.available && !data.locked && !smallScreen && leaseOk && !lostLease
  const seats = data?.seatsPerTable ?? 8

  // While editing, keep the claim alive; if another admin takes over, stop.
  useEffect(() => {
    if (!editing || !lease?.supported) return
    const beat = async () => {
      try {
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'heartbeat', eventId, clientId }) })
        if (res.status === 409) { setEditing(false); setLostLease(true) }
      } catch { /* a missed beat is fine; the claim lasts two minutes */ }
    }
    const t = setInterval(beat, 30000)
    return () => clearInterval(t)
  }, [editing, lease?.supported, eventId, clientId])

  // While only looking, notice when somebody starts or finishes editing.
  useEffect(() => {
    if (editing || !data?.available || !lease?.supported) return
    const poll = async () => {
      try {
        const res = await fetch(`${API}?eventId=${eventId}&clientId=${clientId}&leaseOnly=1`)
        if (res.ok) setLease((await res.json()).lease)
      } catch { /* try again next time */ }
    }
    const t = setInterval(poll, 20000)
    return () => clearInterval(t)
  }, [editing, data?.available, lease?.supported, eventId, clientId])

  // Free the claim when the tab closes or the panel goes away.
  useEffect(() => {
    if (!editing) return
    const release = () => {
      fetch(API, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release', eventId, clientId }) }).catch(() => {})
    }
    window.addEventListener('pagehide', release)
    return () => { window.removeEventListener('pagehide', release); release() }
  }, [editing, eventId, clientId])

  async function startEditing(takeover = false) {
    if (takeover && !confirm(`${lease?.name || 'Another admin'} is editing. If you take over, any changes they have not saved will be lost. Take over editing?`)) return
    setError(''); setNotice('')
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim', eventId, clientId, takeover }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Could not start editing.'); if (d.lease) setLease(d.lease); return }
      setLostLease(false); setEditing(true)
      await load()           // start from the latest saved plan
      setEditing(true)
    } catch { setError('Network error. Please try again.') }
  }

  async function stopEditing() {
    if (dirty && !confirm('You have unsaved changes. Leave editing and discard them?')) return
    setEditing(false); setRenum(null)
    await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release', eventId, clientId }) }).catch(() => {})
    await load()
  }

  function pickForSwap(n: number) {
    setRenum(r => {
      if (!r || r.kind !== 'swap') return r
      if (r.first === null) return { ...r, first: n }
      if (r.first === n) return { ...r, first: null }
      return { ...r, second: n }
    })
    ensureSeated()
  }

  async function ensureSeated() {
    if (seated !== null) return
    try {
      const res = await fetch(`/api/admin/events/seating?eventId=${eventId}`)
      const d = await res.json()
      setSeated(res.ok ? (d.groups || []).map((g: { tables: number[]; headcount: number }) => ({ tables: g.tables || [], headcount: g.headcount || 0 })) : [])
    } catch { setSeated([]) }
  }

  async function doRenumber(undo = false) {
    if (!data) return
    setRenumBusy(true); setError(''); setNotice('')
    try {
      const body: Record<string, unknown> = { action: 'renumber', eventId, clientId, undo }
      if (!undo) {
        body.mapping = mapping
        body.label = renum?.kind === 'swap' ? `Swapped tables ${renum.first} and ${renum.second}` : renum?.kind === 'auto' ? `Numbered by ${ORDER_LABEL[renum.order].toLowerCase()}` : ''
      }
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setRenum(null); setSeated(null)
        await load(); setEditing(true)
        setNotice(`${undo ? 'Renumbering undone' : 'Tables renumbered'}. ${d.bookingsUpdated ?? 0} booking${d.bookingsUpdated === 1 ? '' : 's'} followed their tables.`)
      } else {
        setError(d.error || 'Could not renumber.')
        if (d.leaseLost) { setEditing(false); setLostLease(true) }
        if (d.conflict) setConflict(true)
      }
    } catch { setError('Network error. Nothing was changed.') }
    setRenumBusy(false)
  }

  function edit(next: FloorLayout) { setLayout(next); setDirty(true); setNotice('') }

  function toRoom(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }

  function startDrag(e: React.PointerEvent, d: Omit<Drag, 'startX' | 'startY'> & Record<string, unknown>, sel: Selection) {
    setSelected(sel)
    if (!editable || !layout) return
    e.stopPropagation()
    // Capture keeps the drag alive if the pointer leaves the table; a browser
    // that refuses it (or a synthetic event) still drags, it just cannot follow
    // the pointer outside the plan.
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* optional */ }
    const p = toRoom(e)
    drag.current = { ...(d as object), startX: p.x, startY: p.y } as Drag
    svgRef.current?.focus()
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d || !layout) return
    const p = toRoom(e)
    const dx = p.x - d.startX, dy = p.y - d.startY
    if (d.kind === 'table') {
      const t = layout.tables.find(x => x.n === d.n)
      if (!t) return
      // Snap, then keep the whole table (seats included) inside the room. When the
      // wall is in the way, step back to the nearest grid line that still fits
      // instead of landing between lines.
      const f = footprint(t, seats)
      const fit = (v: number, half: number, size: number) => {
        const lo = half, hi = Math.max(half, size - half)
        let c = sn(v)
        if (grid) {
          if (c < lo) c = Math.ceil(lo / grid) * grid
          if (c > hi) c = Math.floor(hi / grid) * grid
        }
        return Math.min(Math.max(c, lo), hi)
      }
      const moved = { ...t, x: fit(d.origX + dx, f.w / 2, layout.room.w), y: fit(d.origY + dy, f.h / 2, layout.room.h) }
      if (moved.x === t.x && moved.y === t.y) return
      edit({ ...layout, tables: layout.tables.map(x => (x.n === d.n ? moved : x)) })
    } else if (d.kind === 'label') {
      const l = layout.labels.find(x => x.id === d.id)
      if (!l) return
      const x = Math.min(Math.max(sn(d.origX + dx), 0), layout.room.w - l.w)
      const y = Math.min(Math.max(sn(d.origY + dy), 0), layout.room.h - l.h)
      if (x === l.x && y === l.y) return
      edit({ ...layout, labels: layout.labels.map(v => (v.id === d.id ? { ...v, x, y } : v)) })
    } else {
      const l = layout.labels.find(x => x.id === d.id)
      if (!l) return
      const w = Math.min(Math.max(sn(d.origW + dx), 40), Math.min(800, layout.room.w - l.x))
      const h = Math.min(Math.max(sn(d.origH + dy), 30), Math.min(400, layout.room.h - l.y))
      if (w === l.w && h === l.h) return
      edit({ ...layout, labels: layout.labels.map(v => (v.id === d.id ? { ...v, w, h } : v)) })
    }
  }

  function endDrag() { drag.current = null }

  function onKey(e: React.KeyboardEvent) {
    if (!layout || !selected) return
    if (e.key === 'Escape') { setSelected(null); return }
    if (!editable) return
    const step = (e.shiftKey ? 5 : 1) * (grid || GRID)
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (delta[e.key]) {
      e.preventDefault()
      const [dx, dy] = delta[e.key]
      if (selected.type === 'table') {
        edit({ ...layout, tables: layout.tables.map(t => (t.n === selected.n ? clampTable({ ...t, x: t.x + dx, y: t.y + dy }, layout.room, seats) : t)) })
      } else {
        edit({
          ...layout, labels: layout.labels.map(l => (l.id === selected.id ? {
            ...l,
            x: Math.min(Math.max(l.x + dx, 0), layout.room.w - l.w),
            y: Math.min(Math.max(l.y + dy, 0), layout.room.h - l.h),
          } : l)),
        })
      }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected.type === 'label' && document.activeElement === svgRef.current) {
      e.preventDefault(); removeLabel(selected.id)
    }
  }

  function setShape(n: number, shape: TableShape) {
    if (!layout) return
    edit({ ...layout, tables: layout.tables.map(t => (t.n === n ? clampTable({ ...t, shape, rot: shape === 'round' ? 0 : t.rot }, layout.room, seats) : t)) })
  }

  function rotate(n: number) {
    if (!layout) return
    edit({ ...layout, tables: layout.tables.map(t => (t.n === n ? clampTable({ ...t, rot: ((t.rot + 90) % 360) as PlanTable['rot'] }, layout.room, seats) : t)) })
  }

  function addLabel() {
    if (!layout || layout.labels.length >= MAX_LABELS) return
    const id = `l${Date.now().toString(36)}`.slice(0, 30)
    const label: PlanLabel = { id, text: 'Label', x: snap(layout.room.w / 2 - 100), y: 20, w: 200, h: 60 }
    edit({ ...layout, labels: [...layout.labels, label] })
    setSelected({ type: 'label', id })
  }

  function setLabelText(id: string, text: string) {
    if (!layout) return
    edit({ ...layout, labels: layout.labels.map(l => (l.id === id ? { ...l, text: text.replace(/[<>]/g, '').slice(0, MAX_LABEL_TEXT) } : l)) })
  }

  function removeLabel(id: string) {
    if (!layout) return
    edit({ ...layout, labels: layout.labels.filter(l => l.id !== id) })
    setSelected(null)
  }

  async function save() {
    if (!layout || !editable) return
    // A label left blank cannot be saved; say so rather than failing quietly.
    if (layout.labels.some(l => !l.text.trim())) { setError('Every label needs some text. Fill it in or delete the label.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const res = await fetch(API, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, layout, expectedUpdatedAt: updatedAt, clientId }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { setUpdatedAt(d.updatedAt); setDirty(false); setNotice('Layout saved.') }
      else { setError(d.error || 'Could not save.'); if (d.conflict) setConflict(true); if (d.leaseLost) { setEditing(false); setLostLease(true) } }
    } catch { setError('Network error. Your changes are still on screen, try saving again.') }
    setSaving(false)
  }

  async function openCopy() {
    setCopyOpen(o => !o)
    if (sources !== null) return
    try {
      const res = await fetch(`${API}?eventId=${eventId}&sources=1`)
      const d = await res.json()
      setSources(res.ok ? d.sources : [])
    } catch { setSources([]) }
  }

  async function doCopy() {
    if (!copyFrom) return
    if ((data?.saved || dirty) && !confirm('This replaces the current floor plan for this event with the copy. Continue?')) return
    setSaving(true); setError(''); setNotice('')
    try {
      const res = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy', fromEventId: copyFrom, toEventId: eventId, expectedUpdatedAt: updatedAt, clientId }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { setCopyOpen(false); setCopyFrom(''); await load(); setEditing(true); setNotice('Layout copied. Check the tables and save if you change anything.') }
      else { setError(d.error || 'Could not copy.'); if (d.conflict) setConflict(true); if (d.leaseLost) { setEditing(false); setLostLease(true) } }
    } catch { setError('Network error.') }
    setSaving(false)
  }

  const mapping: Mapping | null = useMemo(() => {
    if (!layout || !renum) return null
    if (renum.kind === 'swap') return renum.first !== null && renum.second !== null ? swapMapping(layout.tables.length, renum.first, renum.second) : null
    return autoNumberMapping(layout, seats, renum.order)
  }, [layout, renum, seats])
  const changes = mapping ? Object.entries(mapping).filter(([k, v]) => Number(k) !== v).map(([k, v]) => [Number(k), v] as [number, number]) : []
  const affected = mapping && seated
    ? seated.filter(g => g.tables.some(n => mapping[n] !== undefined && mapping[n] !== n))
    : null

  if (loading) return <div className="px-6 py-8 text-center"><Loader2 className="animate-spin inline" size={20} /></div>
  if (!data) return <div className="px-6 py-5"><p className="text-red-400 text-sm">{error || 'Could not load the floor plan.'}</p></div>
  if (!data.available || !layout) {
    return (
      <div className="px-6 py-5">
        <p className="text-gray-400 text-sm">The floor plan is not available for this event yet. Switch on table seating and set the tables and seats per table under Manage, Event details.</p>
      </div>
    )
  }

  const selTable = selected?.type === 'table' ? layout.tables.find(t => t.n === selected.n) : undefined
  const selLabel = selected?.type === 'label' ? layout.labels.find(l => l.id === selected.id) : undefined
  const btn = 'inline-flex items-center gap-1.5 border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="px-6 py-5 space-y-3">
      <div className="flex gap-2 items-start rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        <Laptop size={18} className="shrink-0 mt-0.5" />
        <span>Do this on a laptop or desktop. Dragging tables does not work reliably on phones or tablets.</span>
      </div>
      {data.locked && (
        <div className="flex gap-2 items-start rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-gray-300">
          <Lock size={16} className="shrink-0 mt-0.5" />
          <span>Seating is locked, so the plan is read-only. Unlock it in the list view to change it.</span>
        </div>
      )}
      {smallScreen && !data.locked && (
        <p className="text-sm text-gray-400">Editing the floor plan needs a laptop or desktop. You can look at it here; use the list view to change seating from this device.</p>
      )}

      {lease?.supported && !data.locked && !smallScreen && (
        editing ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-200">
            <Pencil size={16} className="shrink-0" />
            <span>You are editing this plan. Anyone else sees it as view only until you press Done editing.</span>
            <button type="button" onClick={stopEditing} className="ml-auto border border-green-400/50 rounded-lg px-3 py-1 text-xs hover:bg-green-500/10">Done editing</button>
          </div>
        ) : lostLease ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <span>Another admin has taken over editing. Your unsaved changes cannot be saved.</span>
            <button type="button" onClick={() => { setLostLease(false); load() }} className="ml-auto border border-red-400/50 rounded-lg px-3 py-1 text-xs hover:bg-red-500/10">Reload the plan</button>
          </div>
        ) : lease.active && !lease.mine ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <Lock size={16} className="shrink-0" />
            <span>{lease.name} is editing this plan{lease.since ? ` (since ${clock(lease.since)})` : ''}. View only for now.</span>
            <button type="button" onClick={() => startEditing(true)} className="ml-auto border border-amber-400/50 rounded-lg px-3 py-1 text-xs hover:bg-amber-500/10">Take over editing</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-gray-300">
            <span>View only. Press Edit plan to make changes; while you do, nobody else can edit.</span>
            <button type="button" onClick={() => startEditing(false)} className="ml-auto inline-flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"><Pencil size={14} /> Edit plan</button>
          </div>
        )
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={addLabel} disabled={!editable || layout.labels.length >= MAX_LABELS}><Plus size={14} /> Label</button>
        <button type="button" className={btn} onClick={openCopy} disabled={!editable}><Copy size={14} /> Copy layout</button>
        <label htmlFor="fp-snap" className="inline-flex items-center gap-1.5 text-xs text-gray-300">
          Snap to grid
          <select id="fp-snap" value={grid} onChange={e => setGrid(Number(e.target.value))}
            className="px-2 py-1.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-xs text-gray-200">
            <option value={0}>Off</option>
            <option value={10}>Fine</option>
            <option value={25}>Medium</option>
            <option value={50}>Large</option>
          </select>
        </label>
        <button type="button" className={btn} disabled={!editable || dirty || !!renum || !lease?.supported} title={dirty ? 'Save your layout first' : undefined} onClick={() => { setRenum({ kind: 'swap', first: null, second: null }); ensureSeated() }}><ArrowLeftRight size={14} /> Swap numbers</button>
        <label htmlFor="fp-order" className="sr-only">Number tables in order</label>
        <select
          id="fp-order" value="" disabled={!editable || dirty || !!renum || !lease?.supported} title={dirty ? 'Save your layout first' : undefined}
          onChange={e => { if (e.target.value) { setRenum({ kind: 'auto', order: e.target.value as AutoOrder }); ensureSeated() } }}
          className="px-2 py-1.5 bg-charcoal-800 border border-charcoal-600 rounded-lg text-xs text-gray-200 disabled:opacity-40"
        >
          <option value="">Number tables in order...</option>
          {(Object.keys(ORDER_LABEL) as AutoOrder[]).map(o => <option key={o} value={o}>{ORDER_LABEL[o]}</option>)}
        </select>
        {lastRenumber && (
          <button type="button" className={btn} disabled={!editable || dirty || !!renum || renumBusy}
            onClick={() => { if (confirm('Undo the last renumbering? Tables and the guests seated at them go back to their previous numbers.')) doRenumber(true) }}>
            <Undo2 size={14} /> Undo last renumber
          </button>
        )}
        {selTable && (
          <>
            <span className="text-xs text-gray-500 ml-2">Table {selTable.n}:</span>
            <button type="button" className={btn} disabled={!editable || selTable.shape === 'round'} onClick={() => setShape(selTable.n, 'round')}>Round</button>
            <button type="button" className={btn} disabled={!editable || selTable.shape === 'long'} onClick={() => setShape(selTable.n, 'long')}>Long</button>
            <button type="button" className={btn} disabled={!editable || selTable.shape !== 'long'} onClick={() => rotate(selTable.n)}><RotateCw size={14} /> Rotate</button>
          </>
        )}
        {selLabel && (
          <>
            <label htmlFor="fp-label-text" className="sr-only">Label text</label>
            <input
              id="fp-label-text" value={selLabel.text} onChange={e => setLabelText(selLabel.id, e.target.value)} disabled={!editable}
              maxLength={MAX_LABEL_TEXT} className="ml-2 px-2 py-1 bg-charcoal-700 border border-charcoal-600 rounded text-xs text-white w-40"
            />
            <button type="button" className={btn} disabled={!editable} onClick={() => removeLabel(selLabel.id)}><Trash2 size={14} /> Delete</button>
          </>
        )}
        <span className="ml-auto text-xs text-gray-400">{dirty ? 'Unsaved changes' : data.saved || updatedAt ? 'Saved' : 'Not saved yet'}</span>
        {dirty && <button type="button" className={btn} onClick={load} disabled={saving}>Discard changes</button>}
        <button
          type="button" onClick={save} disabled={!editable || !dirty || saving}
          className="inline-flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save layout
        </button>
      </div>

      {renum && (
        <div className="rounded-lg border border-gold-500/50 bg-gold-500/5 p-3 space-y-2 text-sm text-gray-200">
          {renum.kind === 'swap' && !mapping && (
            <p>Click the two tables whose numbers you want to swap.{renum.first !== null ? ` Table ${renum.first} chosen. Now click the second table.` : ''}</p>
          )}
          {renum.kind === 'auto' && <p>Numbering by: {ORDER_LABEL[renum.order]}. The new numbers are shown in gold on the plan.</p>}
          {mapping && changes.length === 0 && <p>No table would change number.</p>}
          {mapping && changes.length > 0 && (
            <>
              <p>{changes.length} table{changes.length === 1 ? '' : 's'} would change number: {changes.slice(0, 12).map(([a, b]) => `${a} to ${b}`).join(', ')}{changes.length > 12 ? ', ...' : ''}.</p>
              <p>
                {affected === null ? 'Checking who is seated...'
                  : affected.length === 0 ? 'Nobody is seated at those tables yet.'
                  : `${affected.length} group${affected.length === 1 ? '' : 's'} (${affected.reduce((n, g) => n + g.headcount, 0)} guests) seated at those tables will follow their table to its new number.`}
              </p>
              <p className="text-amber-200">Anything already printed or sent that mentions table numbers will be out of date afterwards. You can undo this straight afterwards with one click.</p>
            </>
          )}
          <div className="flex gap-2">
            <button type="button" className="bg-gold-500 hover:bg-gold-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40" disabled={!mapping || isIdentity(mapping) || renumBusy || affected === null} onClick={() => doRenumber(false)}>
              {renumBusy ? 'Renumbering...' : 'Renumber tables'}
            </button>
            <button type="button" className={btn} onClick={() => setRenum(null)} disabled={renumBusy}>Cancel</button>
          </div>
        </div>
      )}

      {copyOpen && (
        <div className="rounded-lg border border-charcoal-600 p-3 space-y-2">
          {sources === null ? <Loader2 size={16} className="animate-spin" /> : sources.length === 0 ? (
            <p className="text-xs text-gray-400">No other event has a saved floor plan yet.</p>
          ) : (
            <>
              <label htmlFor="fp-copy" className="block text-xs text-gray-400">Copy the room, tables and labels from</label>
              <select id="fp-copy" value={copyFrom} onChange={e => setCopyFrom(e.target.value)} className="w-full max-w-sm px-2 py-1.5 bg-charcoal-700 border border-charcoal-600 rounded text-sm text-white">
                <option value="">Choose an event</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.title}{s.tableCount ? ` (${s.tableCount} tables)` : ''}</option>)}
              </select>
              <p className="text-xs text-gray-500">Only the layout is copied, never who sits where. Tables are matched to this event&apos;s table count.</p>
              <button type="button" className={btn} onClick={doCopy} disabled={!copyFrom || saving}>Copy layout</button>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm">
          {error}{conflict && <> <button type="button" className="underline" onClick={load}>Reload</button></>}
        </p>
      )}
      {notice && <p className="text-green-300 text-sm">{notice}</p>}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.room.w} ${layout.room.h}`}
        width="100%"
        tabIndex={0}
        role="application"
        aria-label={`Floor plan with ${layout.tables.length} tables`}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={() => setSelected(null)}
        onKeyDown={onKey}
        className="block rounded-lg border border-charcoal-600 bg-[#242424] outline-none focus:ring-2 focus:ring-gold-500/50 touch-none select-none"
        style={{ aspectRatio: `${layout.room.w} / ${layout.room.h}` }}
      >
        <defs>
          <pattern id="fp-grid-minor" width={grid || 100} height={grid || 100} patternUnits="userSpaceOnUse">
            <path d={`M ${grid || 100} 0 L 0 0 0 ${grid || 100}`} fill="none" stroke="#333333" strokeWidth="1" />
          </pattern>
          <pattern id="fp-grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#444444" strokeWidth="1" />
          </pattern>
        </defs>
        {grid > 0 && grid < 100 && <rect width={layout.room.w} height={layout.room.h} fill="url(#fp-grid-minor)" />}
        <rect width={layout.room.w} height={layout.room.h} fill="url(#fp-grid)" />

        {layout.labels.map(l => {
          const on = selected?.type === 'label' && selected.id === l.id
          return (
            <g
              key={l.id} onPointerDown={e => startDrag(e, { kind: 'label', id: l.id, origX: l.x, origY: l.y }, { type: 'label', id: l.id })}
              style={{ cursor: editable ? 'move' : 'default' }}
            >
              <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={8} fill="#33302a" stroke={on ? '#f3d58a' : '#7a7568'} strokeWidth={on ? 4 : 2} />
              <text x={l.x + l.w / 2} y={l.y + l.h / 2} textAnchor="middle" dominantBaseline="central" fill="#d6d2c4" fontSize={Math.min(34, Math.max(20, l.h * 0.4))} fontFamily="sans-serif">{l.text}</text>
              {on && editable && (
                <rect
                  x={l.x + l.w - 14} y={l.y + l.h - 14} width={14} height={14} fill="#f3d58a" style={{ cursor: 'nwse-resize' }}
                  onPointerDown={e => startDrag(e, { kind: 'resize', id: l.id, origW: l.w, origH: l.h }, { type: 'label', id: l.id })}
                />
              )}
            </g>
          )
        })}

        {layout.tables.map(t => {
          const body = tableBody(t.shape, seats)
          const slots = seatSlots(t.shape, seats)
          const on = selected?.type === 'table' && selected.n === t.n
          const f = footprint(t, seats)
          const next = mapping ? mapping[t.n] : undefined
          const changed = next !== undefined && next !== t.n
          const picked = renum?.kind === 'swap' && (renum.first === t.n || renum.second === t.n)
          return (
            <g
              key={t.n}
              role="button"
              aria-label={`Table ${t.n}, ${t.shape}`}
              onPointerDown={e => { if (renum?.kind === 'swap') { e.stopPropagation(); pickForSwap(t.n); return } startDrag(e, { kind: 'table', n: t.n, origX: t.x, origY: t.y }, { type: 'table', n: t.n }) }}
              style={{ cursor: editable ? 'move' : 'default' }}
            >
              <rect x={t.x - f.w / 2} y={t.y - f.h / 2} width={f.w} height={f.h} fill="transparent" />
              <g transform={`translate(${t.x} ${t.y}) rotate(${t.rot})`}>
                {t.shape === 'round'
                  ? <circle r={body.w / 2} fill="#2e2e2e" stroke={on || picked ? '#f3d58a' : '#666'} strokeWidth={on || picked ? 5 : 2} />
                  : <rect x={-body.w / 2} y={-body.h / 2} width={body.w} height={body.h} rx={8} fill="#2e2e2e" stroke={on || picked ? '#f3d58a' : '#666'} strokeWidth={on || picked ? 5 : 2} />}
                {slots.map((s, i) => <circle key={i} cx={s.dx} cy={s.dy} r={SEAT_R} fill="none" stroke="#8a8a8a" strokeWidth={2.5} />)}
              </g>
              <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="central" fill={changed ? '#f3d58a' : '#fff'} fontSize={30} fontFamily="sans-serif" fontWeight={600}>{changed ? next : t.n}</text>
              {changed && <text x={t.x} y={t.y + 24} textAnchor="middle" dominantBaseline="central" fill="#9a9890" fontSize={18} fontFamily="sans-serif">was {t.n}</text>}
            </g>
          )
        })}
      </svg>

      <p className="text-xs text-gray-500">
        {data.tableCount} tables of {data.seatsPerTable} seats, as set in the event details. To have more or fewer tables, change that
        number there; the plan follows. Click a table to change its shape, drag to move it, or use the arrow keys for small moves.
      </p>
    </div>
  )
}
