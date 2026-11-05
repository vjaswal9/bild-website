'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'

type Ticket = { id: string; name: string; active: boolean; price_aed: number }

type PreviewRow = {
  n: number
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  ticket: string
  party: string
  ref: string
  ticketMatched: boolean
  status: 'new' | 'exists' | 'problem'
  reason: string
}

type Preview = {
  rows: PreviewRow[]
  truncated: boolean
  bookedNow: number
  capacityLimit: number | null
  seatingEnabled: boolean
}

const field = 'w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500'

// Records guests who bought through the ticketing partner, from the guest list
// the partner exports. Step one reads the file and shows what would happen;
// nothing is saved until the admin presses Import. No emails are sent and no
// money is recorded: the sale and the barcodes are the partner's.
export default function ImportGuestsPanel({ eventId, tickets, onCancel, onDone }: {
  eventId: string
  tickets: Ticket[]
  onCancel: () => void
  onDone: () => void
}) {
  const activeTickets = tickets.filter(t => t.active)
  const [ticketId, setTicketId] = useState(activeTickets[0]?.id || '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  // Rows ticked for import, by line number. New people start ticked; people
  // already in BILD start unticked, and can be ticked to add them anyway.
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ imported: number; parties: number; skipped: { name: string; reason: string }[] } | null>(null)

  async function check() {
    setError('')
    if (!file) return setError('Please choose the guest list file first.')
    setBusy(true)
    const form = new FormData()
    form.append('eventId', eventId)
    form.append('file', file)
    const res = await fetch('/api/admin/events/import-guests', { method: 'POST', body: form })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d.error || 'Could not read that file.')
    setPreview(d)
    setTicked(new Set((d.rows as PreviewRow[]).filter(r => r.status === 'new').map(r => r.n)))
  }

  async function runImport() {
    if (!preview) return
    setError('')
    if (!ticketId) return setError('Please choose the ticket package to record them under.')
    const chosen = preview.rows.filter(r => ticked.has(r.n) && r.status !== 'problem')
    if (chosen.length === 0) return setError('Nobody is ticked.')
    if (!confirm(`Add ${chosen.length} guest${chosen.length === 1 ? '' : 's'} to this event? No emails are sent and nothing is charged.`)) return
    setBusy(true)
    const res = await fetch('/api/admin/events/import-guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        defaultTicketId: ticketId,
        rows: chosen.map(r => ({
          n: r.n, firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone,
          ticket: r.ticket, party: r.party, ref: r.ref, force: r.status === 'exists',
        })),
      }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d.error || 'Could not save.')
    setResult({ imported: d.imported, parties: d.parties, skipped: d.skipped || [] })
  }

  const counts = preview && {
    fresh: preview.rows.filter(r => r.status === 'new').length,
    exists: preview.rows.filter(r => r.status === 'exists').length,
    problem: preview.rows.filter(r => r.status === 'problem').length,
  }
  const tickedCount = preview ? preview.rows.filter(r => ticked.has(r.n) && r.status !== 'problem').length : 0
  const afterTotal = preview ? preview.bookedNow + tickedCount : 0

  return (
    <div className="mb-5 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-4">
      <p className="text-white text-sm font-semibold mb-1 flex items-center gap-1.5"><Upload size={15} className="text-sky-400" /> Import Ticketsfy guest list</p>
      <p className="text-gray-500 text-xs mb-3">
        Adds the people who bought through Ticketsfy, so they can be seated and appear on the door list. Nothing is charged
        and no emails are sent. People already booked here (matched by name) are left out unless you tick them.
      </p>

      {result ? (
        <div>
          <p className="text-green-400 text-sm mb-1">
            Added {result.imported} guest{result.imported === 1 ? '' : 's'} in {result.parties} booking{result.parties === 1 ? '' : 's'}.
          </p>
          {result.skipped.length > 0 && (
            <p className="text-gray-500 text-xs mb-3">
              Left out: {result.skipped.map(s => `${s.name} (${s.reason})`).join(', ')}.
            </p>
          )}
          <button onClick={onDone} className="bg-gold-500 hover:bg-gold-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Done</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Record them under this ticket package</span>
              <select id="import-ticket" value={ticketId} onChange={e => setTicketId(e.target.value)} className={field}>
                {activeTickets.length === 0 && <option value="">No active ticket packages</option>}
                {activeTickets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="text-gray-500 text-[11px] block mt-1">Used when the file&rsquo;s ticket type does not match one of this event&rsquo;s packages.</span>
            </label>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Guest list file (CSV or Excel)</span>
              <input
                id="import-file" type="file" accept=".csv,.xlsx,.xls"
                onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); setError('') }}
                className="w-full text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-charcoal-700 file:px-3 file:py-2 file:text-sm file:text-white"
              />
            </label>
          </div>

          {!preview && (
            <button onClick={check} disabled={busy || !file}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold mb-1">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Check the file
            </button>
          )}

          {preview && counts && (
            <div className="mt-2">
              <p className="text-sm text-gray-300 mb-2">
                <span className="text-green-400 font-semibold">{counts.fresh} new</span>
                {counts.exists > 0 && <>, <span className="text-amber-400 font-semibold">{counts.exists} already in BILD or listed twice</span></>}
                {counts.problem > 0 && <>, <span className="text-red-400 font-semibold">{counts.problem} with a problem</span></>}
                .
              </p>
              {preview.truncated && <p className="text-amber-400 text-xs mb-2">Only the first 600 rows were read.</p>}
              <div className="overflow-x-auto max-h-80 overflow-y-auto border border-charcoal-700 rounded-lg mb-3">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="text-gray-500 text-xs sticky top-0 bg-charcoal-800">
                    <tr>
                      <th className="text-left font-medium px-3 py-2 w-10"></th>
                      <th className="text-left font-medium px-2 py-2">Name</th>
                      <th className="text-left font-medium px-2 py-2">Email</th>
                      <th className="text-left font-medium px-2 py-2">Ticket in file</th>
                      <th className="text-left font-medium px-2 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(r => (
                      <tr key={r.n} className="border-t border-charcoal-700">
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox" checked={ticked.has(r.n)} disabled={r.status === 'problem'}
                            aria-label={`Import ${r.name || 'row ' + r.n}`}
                            onChange={e => setTicked(prev => { const next = new Set(prev); if (e.target.checked) next.add(r.n); else next.delete(r.n); return next })}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-white">{r.name || <span className="text-gray-600">(no name)</span>}</td>
                        <td className="px-2 py-1.5 text-gray-400 break-all">{r.email}</td>
                        <td className="px-2 py-1.5 text-gray-400">
                          {r.ticket || '-'}{r.ticket && !r.ticketMatched && <span className="text-gray-600"> (uses package above)</span>}
                        </td>
                        <td className={`px-2 py-1.5 text-xs ${r.status === 'new' ? 'text-green-400' : r.status === 'exists' ? 'text-amber-400' : 'text-red-400'}`}>
                          {r.status === 'new' ? 'New' : r.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-gray-500 text-xs mb-3">
                {tickedCount} ticked. Bookings here would go from {preview.bookedNow} to {afterTotal}
                {preview.capacityLimit != null && <> (this event&rsquo;s limit is {preview.capacityLimit}{afterTotal > preview.capacityLimit ? ', so it would be over. That is fine for tickets sold elsewhere, but check the number is what you expect' : ''})</>}.
                {preview.seatingEnabled && ' Each order is kept together as one table group.'}
              </p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={runImport} disabled={busy || tickedCount === 0}
                  className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Import {tickedCount} guest{tickedCount === 1 ? '' : 's'}
                </button>
                <button onClick={() => { setPreview(null); setFile(null) }} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white">
                  Choose a different file
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <div className="mt-3">
            <button onClick={onCancel} className="text-gray-400 hover:text-white text-sm font-semibold">Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}
