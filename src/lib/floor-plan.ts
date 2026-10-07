// Pure maths for the event floor plan: where tables sit in the room, where the
// seat dots go around them, how a layout is checked before it is saved, and how
// it follows the event's table count. No imports, so it runs in the browser (the
// editor) and on the server (validation) and can be tested on its own.
//
// Units are abstract "room units". The room is drawn as an SVG whose viewBox is
// the room size, so it scales to whatever screen or page it is shown on.

export type TableShape = 'round' | 'long'
export type Rotation = 0 | 90 | 180 | 270

export type PlanTable = { n: number; shape: TableShape; x: number; y: number; rot: Rotation }
export type PlanLabel = { id: string; text: string; x: number; y: number; w: number; h: number }
export type FloorLayout = {
  version: 1
  room: { w: number; h: number }
  tables: PlanTable[]
  labels: PlanLabel[]
}

export const ROOM_W = 1600
export const MIN_ROOM_H = 1000
export const GRID = 10
export const SEAT_R = 9
const SEAT_GAP = 14          // between a table's edge and its seats
const LONG_SPACING = 38      // along a long table, seat centre to seat centre
const LONG_WIDTH = 56
const MARGIN = 50

export const MAX_TABLES = 200
export const MAX_LABELS = 40
export const MAX_LABEL_TEXT = 40

export function snap(v: number, grid = GRID): number {
  return Math.round(v / grid) * grid
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

// The size of the table body itself (no seats), before any rotation.
export function tableBody(shape: TableShape, seats: number): { w: number; h: number } {
  if (shape === 'round') {
    const d = 2 * clamp(30 + seats * 3.2, 44, 86)
    return { w: d, h: d }
  }
  return { w: Math.max(80, Math.ceil(seats / 2) * LONG_SPACING + 16), h: LONG_WIDTH }
}

// Where the seats go, relative to the table's centre, before rotation.
export function seatSlots(shape: TableShape, seats: number): { dx: number; dy: number }[] {
  const out: { dx: number; dy: number }[] = []
  if (shape === 'round') {
    const orbit = tableBody('round', seats).w / 2 + SEAT_R + SEAT_GAP / 2
    for (let i = 0; i < seats; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / seats
      out.push({ dx: orbit * Math.cos(a), dy: orbit * Math.sin(a) })
    }
    return out
  }
  const { w, h } = tableBody('long', seats)
  const top = Math.ceil(seats / 2)
  const bottom = seats - top
  const offset = h / 2 + SEAT_R + SEAT_GAP / 2
  const place = (count: number, dy: number) => {
    for (let i = 0; i < count; i++) {
      const dx = count === 1 ? 0 : -((count - 1) * LONG_SPACING) / 2 + i * LONG_SPACING
      out.push({ dx: clamp(dx, -w / 2 + SEAT_R, w / 2 - SEAT_R), dy })
    }
  }
  place(top, -offset)
  place(bottom, offset)
  return out
}

// Bounding box of a table plus its seats, after rotation. Used to keep tables
// inside the room and to find free space.
export function footprint(t: Pick<PlanTable, 'shape' | 'rot'>, seats: number): { w: number; h: number } {
  const body = tableBody(t.shape, seats)
  const reach = SEAT_GAP / 2 + SEAT_R * 2
  let w: number, h: number
  if (t.shape === 'round') {
    w = h = body.w + reach * 2
  } else {
    w = Math.max(body.w, Math.ceil(seats / 2) * LONG_SPACING) + SEAT_R * 2
    h = body.h + reach * 2
  }
  return t.rot === 90 || t.rot === 270 ? { w: h, h: w } : { w, h }
}

// Keeps a table's whole footprint (seats included) inside the room.
export function clampTable<T extends PlanTable>(t: T, room: { w: number; h: number }, seats: number): T {
  const f = footprint(t, seats)
  return {
    ...t,
    x: clamp(t.x, f.w / 2, Math.max(f.w / 2, room.w - f.w / 2)),
    y: clamp(t.y, f.h / 2, Math.max(f.h / 2, room.h - f.h / 2)),
  }
}

function overlaps(a: PlanTable, b: PlanTable, seats: number): boolean {
  const fa = footprint(a, seats), fb = footprint(b, seats)
  return Math.abs(a.x - b.x) < (fa.w + fb.w) / 2 && Math.abs(a.y - b.y) < (fa.h + fb.h) / 2
}

// The first free spot for a table, scanning the room left to right, top to
// bottom. The room grows downwards if it is full.
function placeInFreeSpot(
  n: number, shape: TableShape, seats: number, existing: PlanTable[], room: { w: number; h: number },
): { table: PlanTable; roomH: number } {
  const f = footprint({ shape, rot: 0 }, seats)
  const stepX = Math.ceil(f.w / GRID) * GRID + 10
  // Rows are spaced further apart than columns so there is room under each table for the names on the printed plan.
  const stepY = Math.ceil(f.h / GRID) * GRID + 50
  let roomH = room.h
  for (let attempt = 0; attempt < 200; attempt++) {
    for (let y = MARGIN + f.h / 2; y + f.h / 2 <= roomH - MARGIN; y += stepY) {
      for (let x = MARGIN + f.w / 2; x + f.w / 2 <= room.w - MARGIN; x += stepX) {
        const cand: PlanTable = { n, shape, x: snap(x), y: snap(y), rot: 0 }
        if (!existing.some(e => overlaps(cand, e, seats))) return { table: cand, roomH }
      }
    }
    roomH += stepY * 2
  }
  return { table: { n, shape, x: snap(room.w / 2), y: snap(roomH / 2), rot: 0 }, roomH }
}

export function emptyLayout(): FloorLayout {
  return { version: 1, room: { w: ROOM_W, h: MIN_ROOM_H }, tables: [], labels: [] }
}

// A tidy starting layout: tables 1..N in neat rows. Nothing is saved until the
// owner edits, so this is only ever a suggestion.
export function defaultLayout(tableCount: number, seats: number, shape: TableShape = 'round'): FloorLayout {
  return reconcileLayout(emptyLayout(), tableCount, seats, shape).layout
}

// Makes a layout agree with the event's table count: tables 1..tableCount all
// present (new ones go in free spots), tables above the count removed. Existing
// positions and shapes are never moved. Never mutates its input.
export function reconcileLayout(
  layout: FloorLayout | null, tableCount: number, seats: number, newShape: TableShape = 'round',
): { layout: FloorLayout; added: number[]; dropped: number[] } {
  const base = layout ?? emptyLayout()
  const room = { w: base.room.w, h: base.room.h }
  const kept = base.tables.filter(t => t.n >= 1 && t.n <= tableCount).map(t => clampTable({ ...t }, room, seats))
  const dropped = base.tables.filter(t => t.n > tableCount).map(t => t.n)
  const have = new Set(kept.map(t => t.n))
  const added: number[] = []
  const tables = [...kept]
  // Match the shape most tables already use, so a new table looks like its neighbours.
  const shape: TableShape = kept.length ? (kept.filter(t => t.shape === 'long').length > kept.length / 2 ? 'long' : 'round') : newShape
  for (let n = 1; n <= tableCount; n++) {
    if (have.has(n)) continue
    const placed = placeInFreeSpot(n, shape, seats, tables, room)
    room.h = Math.max(room.h, placed.roomH)
    tables.push(placed.table)
    added.push(n)
  }
  tables.sort((a, b) => a.n - b.n)
  return { layout: { version: 1, room, tables, labels: base.labels.map(l => ({ ...l })) }, added, dropped }
}

// Copy of a layout for a different event: same room, labels and table
// positions (with new label ids), made to fit this event's table count.
export function copyLayout(source: FloorLayout, tableCount: number, seats: number): FloorLayout {
  const labels = source.labels.map((l, i) => ({ ...l, id: `c${i + 1}-${l.id}`.slice(0, 30) }))
  return reconcileLayout({ ...source, labels }, tableCount, seats).layout
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export type Validated = { ok: true; layout: FloorLayout } | { ok: false; error: string }

// Checks an untrusted layout (from a request) and returns a cleaned copy.
export function validateLayout(raw: unknown, tableCount: number, seats: number): Validated {
  const bad = (error: string): Validated => ({ ok: false, error })
  if (!raw || typeof raw !== 'object') return bad('The layout is missing.')
  const r = raw as Record<string, unknown>
  if (r.version !== 1) return bad('Unsupported layout version.')

  const rm = r.room as Record<string, unknown> | undefined
  if (!rm || !finite(rm.w) || !finite(rm.h)) return bad('The room size is missing.')
  const room = { w: clamp(Math.round(rm.w), 400, 4000), h: clamp(Math.round(rm.h), 400, 4000) }

  if (!Array.isArray(r.tables) || r.tables.length > MAX_TABLES) return bad('Too many tables.')
  const seen = new Set<number>()
  const tables: PlanTable[] = []
  for (const t of r.tables as Record<string, unknown>[]) {
    if (!t || typeof t !== 'object') return bad('A table is malformed.')
    if (!Number.isInteger(t.n) || (t.n as number) < 1 || (t.n as number) > tableCount) return bad(`Table numbers must be between 1 and ${tableCount}.`)
    if (seen.has(t.n as number)) return bad('A table number is used twice.')
    if (t.shape !== 'round' && t.shape !== 'long') return bad('A table has an unknown shape.')
    if (![0, 90, 180, 270].includes(t.rot as number)) return bad('A table has an unsupported rotation.')
    if (!finite(t.x) || !finite(t.y)) return bad('A table has no position.')
    seen.add(t.n as number)
    // Whole numbers only: the editor snaps to whichever grid the admin chose (or none), so the server must not move things to a grid of its own.
    tables.push(clampTable({ n: t.n as number, shape: t.shape, x: Math.round(t.x), y: Math.round(t.y), rot: t.rot as Rotation }, room, seats))
  }

  if (!Array.isArray(r.labels) || r.labels.length > MAX_LABELS) return bad('Too many labels.')
  const ids = new Set<string>()
  const labels: PlanLabel[] = []
  for (const l of r.labels as Record<string, unknown>[]) {
    if (!l || typeof l !== 'object') return bad('A label is malformed.')
    const id = typeof l.id === 'string' ? l.id : ''
    if (!/^[A-Za-z0-9-]{1,30}$/.test(id) || ids.has(id)) return bad('A label has an invalid id.')
    // Plain text only: the characters that could start markup are stripped.
    const text = typeof l.text === 'string' ? l.text.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, MAX_LABEL_TEXT) : ''
    if (!text) return bad('A label has no text.')
    if (![l.x, l.y, l.w, l.h].every(finite)) return bad('A label has no position or size.')
    ids.add(id)
    const w = clamp(Math.round(l.w as number), 40, 800), h = clamp(Math.round(l.h as number), 30, 400)
    labels.push({
      id, text, w, h,
      x: clamp(Math.round(l.x as number), 0, Math.max(0, room.w - w)),
      y: clamp(Math.round(l.y as number), 0, Math.max(0, room.h - h)),
    })
  }

  return { ok: true, layout: { version: 1, room, tables, labels } }
}

// ---------------------------------------------------------------------------
// Renumbering. A mapping says "the table now called OLD becomes NEW"; it must be
// a permutation of 1..tableCount so no number is lost or used twice. Guests
// follow their physical table, so the mapping is applied to the layout and to
// every booking's table list in one go (the database function does the latter).
// ---------------------------------------------------------------------------

export type Mapping = Record<number, number>
export type AutoOrder = 'rows' | 'columns' | 'clockwise' | 'anticlockwise'

export function isPermutation(mapping: unknown, tableCount: number): mapping is Mapping {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return false
  const entries = Object.entries(mapping as Record<string, unknown>)
  if (entries.length !== tableCount) return false
  const keys = new Set<number>(), values = new Set<number>()
  for (const [k, v] of entries) {
    const key = Number(k)
    if (!/^[0-9]+$/.test(k) || !Number.isInteger(v) || key < 1 || key > tableCount || (v as number) < 1 || (v as number) > tableCount) return false
    keys.add(key); values.add(v as number)
  }
  return keys.size === tableCount && values.size === tableCount
}

export function identityMapping(tableCount: number): Mapping {
  const m: Mapping = {}
  for (let n = 1; n <= tableCount; n++) m[n] = n
  return m
}

// Two tables trade numbers; everything else stays.
export function swapMapping(tableCount: number, a: number, b: number): Mapping {
  const m = identityMapping(tableCount)
  if (a >= 1 && a <= tableCount && b >= 1 && b <= tableCount) { m[a] = b; m[b] = a }
  return m
}

export function invertMapping(mapping: Mapping): Mapping {
  const out: Mapping = {}
  for (const [k, v] of Object.entries(mapping)) out[v] = Number(k)
  return out
}

export function isIdentity(mapping: Mapping): boolean {
  return Object.entries(mapping).every(([k, v]) => Number(k) === v)
}

// The layout with every table renumbered. Positions and shapes stay with the
// physical table; only the number changes. Never mutates the input.
export function applyMapping(layout: FloorLayout, mapping: Mapping): FloorLayout {
  const tables = layout.tables.map(t => ({ ...t, n: mapping[t.n] ?? t.n })).sort((a, b) => a.n - b.n)
  return { ...layout, tables, labels: layout.labels.map(l => ({ ...l })) }
}

// A tidy numbering of tables by where they sit in the room. Returns a mapping
// from each table's current number to its new one.
export function autoNumberMapping(layout: FloorLayout, seats: number, order: AutoOrder): Mapping {
  const tables = layout.tables
  if (tables.length === 0) return {}
  const heights = tables.map(t => footprint(t, seats).h).sort((a, b) => a - b)
  const widths = tables.map(t => footprint(t, seats).w).sort((a, b) => a - b)
  const midH = heights[Math.floor(heights.length / 2)], midW = widths[Math.floor(widths.length / 2)]

  let sorted: PlanTable[]
  if (order === 'rows' || order === 'columns') {
    // Group tables into rows (or columns) of roughly equal y (or x), then go
    // along each one. Two tables belong to the same row if they are less than
    // half a table apart across the row's direction.
    const major = order === 'rows' ? (t: PlanTable) => t.y : (t: PlanTable) => t.x
    const minor = order === 'rows' ? (t: PlanTable) => t.x : (t: PlanTable) => t.y
    const tol = (order === 'rows' ? midH : midW) / 2
    const byMajor = [...tables].sort((a, b) => major(a) - major(b) || minor(a) - minor(b))
    const bands: PlanTable[][] = []
    let anchor = -Infinity
    for (const t of byMajor) {
      if (bands.length === 0 || major(t) - anchor > tol) { bands.push([t]); anchor = major(t) } else bands[bands.length - 1].push(t)
    }
    sorted = bands.flatMap(b => b.sort((a, c) => minor(a) - minor(c) || a.n - c.n))
  } else {
    // Around the middle of the group of tables, starting at the top and going
    // clockwise (or the other way).
    const cx = tables.reduce((s, t) => s + t.x, 0) / tables.length
    const cy = tables.reduce((s, t) => s + t.y, 0) / tables.length
    const angle = (t: PlanTable) => {
      let a = (Math.atan2(t.y - cy, t.x - cx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI)
      if (order === 'anticlockwise') a = (2 * Math.PI - a) % (2 * Math.PI)
      return Math.round(a * 1e6) / 1e6
    }
    sorted = [...tables].sort((a, b) => angle(a) - angle(b) || Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy) || a.n - b.n)
  }
  const m: Mapping = {}
  sorted.forEach((t, i) => { m[t.n] = i + 1 })
  return m
}
