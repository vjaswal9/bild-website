'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Lock, Unlock, Wand2, Users, AlertTriangle, Merge, ArrowRightLeft } from 'lucide-react'
import { seatsLeftPerTable, wholeTablesFree } from '@/lib/seating-fit'

type Group = {
  key: string
  code: string | null
  organiserName: string
  headcount: number
  oversized: boolean
  tables: number[]
  // This group exists only because `overflowFromCode`'s table was already
  // full when they tried to join it - null for an ordinary group.
  overflowFromCode: string | null
  // Codes of other groups that spilled out of THIS group's table, if any -
  // the reverse of overflowFromCode, shown so a full table's own row also
  // flags who should be seated nearby.
  overflowsInto: string[]
  bookings: { id: string; name: string; quantity: number }[]
}

type SeatingData = {
  seatingEnabled: boolean
  tableCount: number | null
  seatsPerTable: number | null
  locked: boolean
  totalHeadcount: number
  totalCapacity: number | null
  groups: Group[]
}

// Admin's working session the day (or hour) before an event: review the
// groups people formed themselves, merge the ones that are obviously the same
// party split by accident, click Auto-assign, fix anything by hand, then lock
// it so the door list stops moving.
export default function SeatingPanel({ eventId }: { eventId: string }) {
  const [data, setData] = useState<SeatingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Checkbox selection for the merge action, keyed by group.key.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mergeTarget, setMergeTarget] = useState('')
  // Which group's table picker is expanded, if any - only one at a time.
  const [openPicker, setOpenPicker] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/events/seating?eventId=${eventId}`)
      const d = await res.json()
      if (res.ok) setData(d)
      else setError(d.error || 'Could not load seating.')
    } catch {
      setError('Network error loading seating.')
    }
    setLoading(false)
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function act(body: Record<string, unknown>) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/events/seating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, ...body }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error || 'Something went wrong.')
        setBusy(false)
        return null
      }
      await load()
      setBusy(false)
      return d
    } catch {
      setError('Network error.')
      setBusy(false)
      return null
    }
  }

  if (loading) {
    return <div className="px-6 py-8 text-center"><Loader2 className="animate-spin inline" size={20} /></div>
  }
  if (!data) {
    return <div className="px-6 py-5"><p className="text-red-400 text-sm">{error || 'Could not load seating.'}</p></div>
  }
  if (!data.seatingEnabled) {
    return (
      <div className="px-6 py-5">
        <p className="text-gray-400 text-sm">
          Table seating is off for this event. Turn it on under Manage &rarr; Event details to set the number of
          tables and seats per table.
        </p>
      </div>
    )
  }
  if (!data.tableCount || !data.seatsPerTable) {
    return (
      <div className="px-6 py-5">
        <p className="text-gray-400 text-sm">
          Set the number of tables and seats per table under Manage &rarr; Event details before assigning tables.
        </p>
      </div>
    )
  }

  const { groups, tableCount, seatsPerTable, totalHeadcount, totalCapacity, locked } = data
  // A projection, not today's hand-placed layout: every party so far packed
  // in largest first, the way Auto-assign would. It shows how many tables
  // could still take a big new party.
  const tablesFree = wholeTablesFree(seatsLeftPerTable(groups.map(g => g.headcount), tableCount, seatsPerTable), seatsPerTable)
  const unassigned = groups.filter(g => g.tables.length === 0)
  // Still needs attention: either it has no table(s) yet, or the table(s)
  // picked so far don't add up to enough seats for the headcount. Once an
  // admin has given a big group enough tables, it drops off this list even
  // though it will always structurally be "too big for one table".
  const needsTables = groups.filter(g =>
    g.oversized && (g.tables.length === 0 || (seatsPerTable != null && g.tables.length * seatsPerTable < g.headcount)),
  )

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleGroupTable(g: Group, n: number) {
    const next = g.tables.includes(n) ? g.tables.filter(t => t !== n) : [...g.tables, n]
    act({ action: 'set_table', groupKey: g.key, tables: next })
  }

  async function doMerge() {
    if (selected.size === 0) return setError('Select at least one booking to merge.')
    const code = mergeTarget || 'NEW'
    const result = await act({ action: 'set_code', groupKeys: Array.from(selected), code })
    if (result) {
      setSelected(new Set())
      setMergeTarget('')
      setNotice(`Moved into table code ${result.code}. Table assignments were cleared for the moved bookings - re-run Auto-assign or place the table by hand.`)
    }
  }

  async function doAutoAssign() {
    const result = await act({ action: 'auto_assign' })
    if (result) {
      setNotice(
        result.unplaced.length === 0
          ? `Placed all ${result.placedGroups} groups across ${tableCount} tables.`
          : `Placed ${result.placedGroups} groups. ${result.unplaced.length} could not be placed: ${result.unplaced
              .map((u: { name: string; headcount: number; oversized: boolean }) =>
                `${u.name} (${u.headcount} people${u.oversized ? ', bigger than one table' : ', no table had room'})`)
              .join('; ')}.`,
      )
    }
  }

  return (
    <div className="px-6 py-5">
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300 text-sm">{error}</div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-2 text-gold-300 text-sm">{notice}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <span className="flex items-center gap-1.5"><Users size={14} /> {totalHeadcount} people{totalCapacity != null ? ` / ${totalCapacity} seats` : ''}</span>
          <span>{tableCount} tables &times; {seatsPerTable} seats</span>
          <span
            className={tablesFree <= 1 ? 'text-amber-400' : undefined}
            title={`Tables with all ${seatsPerTable} seats still empty, if everyone booked so far were packed in largest party first. A party of ${seatsPerTable} needs one of these.`}
          >
            Whole tables free: {tablesFree}
          </span>
          {unassigned.length > 0 && <span className="text-amber-400">{unassigned.length} groups unassigned</span>}
          {needsTables.length > 0 && <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={13} /> {needsTables.length} need more than one table</span>}
        </div>
        <div className="flex items-center gap-2">
          {locked ? (
            <button onClick={() => act({ action: 'unlock' })} disabled={busy}
              className="inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              <Unlock size={13} /> Unlock
            </button>
          ) : (
            <>
              <button onClick={doAutoAssign} disabled={busy}
                className="inline-flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                <Wand2 size={13} /> Auto-assign
              </button>
              <button onClick={() => act({ action: 'lock' })} disabled={busy}
                className="inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                <Lock size={13} /> Lock plan
              </button>
            </>
          )}
        </div>
      </div>

      {locked && (
        <p className="text-amber-400 text-xs mb-4 flex items-center gap-1.5">
          <Lock size={12} /> Locked - table numbers are on the door list. Unlock to make changes.
        </p>
      )}

      {!locked && selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 bg-charcoal-700/50 rounded-xl p-3">
          <Merge size={14} className="text-gold-400" />
          <span className="text-gray-300 text-xs">{selected.size} selected &rarr; merge into</span>
          <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)}
            className="bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-xs px-2 py-1.5">
            <option value="">a new code</option>
            {groups.filter(g => g.code && !selected.has(g.key)).map(g => (
              <option key={g.code} value={g.code!}>{g.code} ({g.organiserName})</option>
            ))}
          </select>
          <button onClick={doMerge} disabled={busy}
            className="bg-gold-500 hover:bg-gold-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">
            Merge
          </button>
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-white text-xs">Clear</button>
        </div>
      )}

      <div className="space-y-2">
        {groups.map(g => {
          const seatsCovered = seatsPerTable != null ? g.tables.length * seatsPerTable : null
          const stillTight = g.oversized && (g.tables.length === 0 || (seatsCovered != null && seatsCovered < g.headcount))
          const pickerOpen = openPicker === g.key
          return (
          <div key={g.key} className={`rounded-xl border px-4 py-3 ${stillTight ? 'border-red-500/40 bg-red-500/5' : 'border-charcoal-700 bg-charcoal-700/30'}`}>
            <div className="flex items-start gap-3">
              {!locked && (
                <input
                  type="checkbox"
                  checked={selected.has(g.key)}
                  onChange={() => toggleSelect(g.key)}
                  className="mt-1 h-4 w-4 accent-gold-500"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-sm">{g.organiserName}&rsquo;s group</span>
                  {g.code && <span className="text-gray-500 text-xs font-mono">{g.code}</span>}
                  {!g.code && <span className="text-gray-500 text-xs italic">no code</span>}
                  <span className="text-gray-400 text-xs">{g.headcount} {g.headcount === 1 ? 'person' : 'people'}</span>
                  {g.oversized && (
                    <span className={`text-xs flex items-center gap-1 ${stillTight ? 'text-red-400' : 'text-green-400'}`}>
                      <AlertTriangle size={11} />
                      {stillTight
                        ? `needs more than one table${seatsCovered != null && g.tables.length > 0 ? ` (${seatsCovered} of ${g.headcount} seats so far)` : ''}`
                        : `split across ${g.tables.length} tables - they can sort out who sits where`}
                    </span>
                  )}
                  {g.overflowFromCode && (
                    <span className="text-xs flex items-center gap-1 text-amber-400" title={`This group only exists because ${g.overflowFromCode} was already full when they tried to join it`}>
                      <ArrowRightLeft size={11} /> overflowed from {g.overflowFromCode} - seat near that table
                    </span>
                  )}
                  {g.overflowsInto.length > 0 && (
                    <span className="text-xs flex items-center gap-1 text-amber-400" title="These groups spilled out of this table because it was full - worth seating them nearby">
                      <ArrowRightLeft size={11} /> overflow at {g.overflowsInto.join(', ')} - seat nearby
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-0.5 truncate">
                  {g.bookings.map(b => `${b.name} (${b.quantity})`).join(', ')}
                </p>
              </div>
              <div className="shrink-0 relative">
                <button
                  type="button"
                  disabled={locked || busy}
                  onClick={() => setOpenPicker(pickerOpen ? null : g.key)}
                  className={`border rounded-lg text-xs px-2 py-1.5 font-semibold disabled:opacity-50 ${
                    g.tables.length > 0 ? 'bg-green-600/20 border-green-600/40 text-green-300' : 'bg-charcoal-700 border-charcoal-600 text-gray-300'
                  }`}
                >
                  {g.tables.length === 0 ? 'Unassigned' : `Table${g.tables.length > 1 ? 's' : ''} ${g.tables.slice().sort((a, b) => a - b).join(', ')}`}
                </button>
                {pickerOpen && !locked && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-charcoal-800 border border-charcoal-600 rounded-lg p-2 shadow-xl w-40 max-h-56 overflow-y-auto">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide px-1 mb-1">
                      Tick as many as this group needs
                    </p>
                    {Array.from({ length: tableCount }, (_, i) => i + 1).map(n => (
                      <label key={n} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-charcoal-700 cursor-pointer text-xs text-gray-200">
                        <input
                          type="checkbox"
                          checked={g.tables.includes(n)}
                          disabled={busy}
                          onChange={() => toggleGroupTable(g, n)}
                          className="h-3.5 w-3.5 accent-gold-500"
                        />
                        Table {n}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          )
        })}
        {groups.length === 0 && <p className="text-gray-500 text-sm">No paid bookings yet.</p>}
      </div>
      {openPicker && (
        // Click-away backdrop for the table picker popover, below it in z-order.
        <div className="fixed inset-0 z-10" onClick={() => setOpenPicker(null)} />
      )}
    </div>
  )
}
