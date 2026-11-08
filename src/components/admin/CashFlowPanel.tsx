'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Trash2, Plus } from 'lucide-react'
import type { EventRegistration, EventTicket } from '@/lib/events'
import {
  buildCashFlow, hotelBillAed, type CardSales, type CashCostLine, type CashLine, type CashRevenueLine, type CostPayment, type TimelineRow,
} from '@/lib/cash-flow'

type Data = { card: CardSales; revenue: CashRevenueLine[]; costs: CashCostLine[]; costPayments: CostPayment[]; venue: CashLine[] }

const aed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const input = 'bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500'
const dubaiToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' })
const niceDate = (d: string | null) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' | 'plain' }) {
  const colour = tone === 'bad' || value < 0 ? 'text-red-400' : tone === 'good' ? 'text-green-400' : 'text-white'
  return (
    <div className="rounded-xl bg-charcoal-700/50 px-4 py-3">
      <p className={`text-xl font-display font-bold tabular-nums ${colour}`}>{aed(value)}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}

// When the money moves, as opposed to whether the event made money. Nothing
// here changes a profit figure: costs and hand-typed income only gain a paid /
// received flag, and payments towards the hotel bill are kept apart from costs
// so they can never be counted twice.
export default function CashFlowPanel({ eventId, tickets, registrations }: {
  eventId: string
  tickets: EventTicket[]
  registrations: EventRegistration[]
}) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const blank = { date: dubaiToday(), description: '', amountAed: '', settled: false }
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  // The cost whose actual payment dates are open for editing, and the payment being typed.
  const [payFor, setPayFor] = useState<string | null>(null)
  const [payForm, setPayForm] = useState({ date: dubaiToday(), amountAed: '' })

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/events/cashflow?eventId=${eventId}`)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return setError(d.error || 'Could not load the cash flow.')
    setError(''); setData(d)
  }, [eventId])
  useEffect(() => { load() }, [load])

  const bill = useMemo(() => hotelBillAed(registrations, tickets), [registrations, tickets])
  const flow = useMemo(() => data && buildCashFlow({
    card: data.card, revenue: data.revenue, costs: data.costs, costPayments: data.costPayments, venue: data.venue, hotelBill: bill, today: dubaiToday(),
  }), [data, bill])

  const openPayments = (costId: string) => { setPayFor(costId); setError('') }

  // Whenever a different cost is opened, or its payments change, offer what is
  // left to pay as the amount, dated today. Typing over either is fine.
  const paidOnOpen = Math.round((data?.costPayments || []).filter(p => p.costId === payFor).reduce((n, p) => n + p.amountAed, 0) * 100) / 100
  const costOnOpen = data?.costs.find(c => c.id === payFor)?.amountAed ?? 0
  useEffect(() => {
    if (!payFor) return
    const left = Math.max(0, Math.round((costOnOpen - paidOnOpen) * 100) / 100)
    setPayForm({ date: dubaiToday(), amountAed: left > 0 ? String(left) : '' })
  }, [payFor, paidOnOpen, costOnOpen])

  async function addPayment() {
    if (!payFor) return
    setError('')
    const amount = parseFloat(payForm.amountAed)
    if (!payForm.date) return setError('Please give the date the payment was made.')
    if (!Number.isFinite(amount) || amount <= 0) return setError('Please enter an amount greater than zero.')
    setSaving(true)
    const res = await fetch('/api/admin/events/cashflow', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'costpay', eventId, costId: payFor, date: payForm.date, amountAed: amount }),
    })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(d.error || 'Could not save.')
    await load()
  }

  async function removePayment(id: string) {
    if (!confirm('Remove this payment? The cost itself stays, and profit does not change.')) return
    setBusyKey(`costpay:${id}`)
    const res = await fetch(`/api/admin/events/cashflow?eventId=${eventId}&id=${id}&type=costpay`, { method: 'DELETE' })
    setBusyKey(null)
    if (!res.ok) return setError('Could not remove it.')
    await load()
  }

  async function toggle(row: TimelineRow) {
    if (!row.line) return
    // Once a cost has actual payments, its paid flag no longer matters: the
    // payments say what has gone out. Pressing its status opens them instead.
    if (row.line.costId && row.split) return openPayments(row.line.costId)
    setBusyKey(row.key); setError('')
    const res = await fetch('/api/admin/events/cashflow', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, type: row.line.type, id: row.line.id, settled: !row.settled }),
    })
    const d = await res.json().catch(() => ({}))
    setBusyKey(null)
    if (!res.ok) return setError(d.error || 'Could not save.')
    load()
  }

  async function saveVenue() {
    setError('')
    const amount = parseFloat(form.amountAed)
    if (!form.description.trim()) return setError('Please say what the payment is for.')
    if (!Number.isFinite(amount) || amount <= 0) return setError('Please enter an amount greater than zero.')
    setSaving(true)
    const res = await fetch('/api/admin/events/cashflow', {
      method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), eventId, date: form.date, description: form.description.trim(), amountAed: amount, settled: form.settled }),
    })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(d.error || 'Could not save.')
    setForm(blank); setAdding(false); setEditingId(null); load()
  }

  async function removeVenue(id: string) {
    if (!confirm('Remove this payment from the cash flow? It was never counted as a cost, so profit does not change.')) return
    setBusyKey(`venue:${id}`)
    const res = await fetch(`/api/admin/events/cashflow?eventId=${eventId}&id=${id}`, { method: 'DELETE' })
    setBusyKey(null)
    if (!res.ok) return setError('Could not remove it.')
    load()
  }

  function startEdit(v: CashLine) {
    setForm({ date: v.date, description: v.description, amountAed: String(v.amountAed), settled: v.settled })
    setEditingId(v.id); setAdding(true); setError('')
  }

  if (!data || !flow) {
    return (
      <div className="px-6 py-6 text-sm text-gray-400">
        {error ? <p className="text-red-400">{error}</p> : <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading cash flow...</span>}
      </div>
    )
  }

  const paidLabel = (r: TimelineRow) => r.kind === 'revenue' ? (r.settled ? 'Received' : 'Not yet received') : (r.settled ? 'Paid' : 'Not yet paid')

  return (
    <div className="px-6 py-6 space-y-6">
      <p className="text-gray-400 text-sm">
        This shows when money moves, not whether the event made a profit. Nothing here changes the profit figures in Event Data.
      </p>

      <div>
        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">So far</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Tile label="Received so far" value={flow.cashIn} />
          <Tile label="Paid so far" value={flow.paidOut} />
          <Tile label="Cash from this event now" value={flow.cashNow} tone={flow.cashNow >= 0 ? 'good' : 'bad'} />
        </div>
      </div>
      <div>
        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Still to come</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Tile label="Still to receive" value={flow.toReceive} />
          <Tile label="Still to pay" value={flow.toPay} />
          <Tile label="Expected at the end" value={flow.expectedEnd} tone={flow.expectedEnd >= 0 ? 'good' : 'bad'} />
        </div>
      </div>

      {/* ---- The hotel / venue bill ---- */}
      <div className="rounded-xl border border-charcoal-600 bg-charcoal-700/30 px-4 py-4">
        <p className="text-white text-sm font-semibold mb-1">Hotel / venue bill</p>
        <p className="text-gray-400 text-xs mb-3">
          The ticket cost prices add up to <span className="text-white font-semibold">{aed(flow.hotelBill)} AED</span> for the tickets sold.
          Record here what you pay, or plan to pay, towards it, such as a deposit. These are not extra costs, so they never change profit.
          {flow.hotelBill === 0 && ' No ticket cost prices are set on this event yet, so the bill shows as zero.'}
        </p>
        <p className="text-sm text-gray-300 mb-3">
          Entered: <span className="text-white font-semibold">{aed(flow.hotelScheduled)}</span>
          {' '}· Not yet given a date: <span className={flow.hotelUnscheduled > 0 ? 'text-amber-300 font-semibold' : 'text-white font-semibold'}>{aed(flow.hotelUnscheduled)}</span>
          {flow.hotelOver > 0 && <span className="text-amber-300"> · Entered is {aed(flow.hotelOver)} more than the bill so far (more tickets may still sell)</span>}
        </p>

        {data.venue.length > 0 && (
          <ul className="divide-y divide-charcoal-700 mb-3">
            {data.venue.map(v => (
              <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-gray-400 w-28 shrink-0">{niceDate(v.date)}</span>
                <span className="text-white min-w-0 flex-1 truncate">{v.description}</span>
                <span className="text-white tabular-nums">{aed(v.amountAed)}</span>
                <span className={`text-xs ${v.settled ? 'text-green-400' : 'text-amber-300'}`}>{v.settled ? 'Paid' : 'Planned'}</span>
                <button onClick={() => startEdit(v)} className="text-gray-500 hover:text-white p-1" aria-label={`Edit ${v.description}`}><Pencil size={14} /></button>
                <button onClick={() => removeVenue(v.id)} disabled={busyKey === `venue:${v.id}`} className="text-gray-500 hover:text-red-400 p-1" aria-label={`Remove ${v.description}`}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr_9rem] gap-2">
            <input type="date" id="cf-date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={input} aria-label="Date" />
            <input type="text" id="cf-desc" value={form.description} maxLength={120} placeholder="e.g. Deposit to the hotel"
              onChange={e => setForm({ ...form, description: e.target.value })} className={input} aria-label="What the payment is for" />
            <input type="number" id="cf-amount" min="0" step="0.01" value={form.amountAed} placeholder="Amount (AED)"
              onChange={e => setForm({ ...form, amountAed: e.target.value })} className={input} aria-label="Amount in AED" />
            <label className="sm:col-span-3 inline-flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" id="cf-settled" checked={form.settled} onChange={e => setForm({ ...form, settled: e.target.checked })} className="h-4 w-4 accent-gold-500" />
              Already paid (leave unticked if it is planned for the date above)
            </label>
            <div className="sm:col-span-3 flex gap-2">
              <button onClick={saveVenue} disabled={saving}
                className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                {saving && <Loader2 size={14} className="animate-spin" />} {editingId ? 'Save changes' : 'Add payment'}
              </button>
              <button onClick={() => { setAdding(false); setEditingId(null); setForm(blank); setError('') }} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setForm(blank); setEditingId(null); setAdding(true) }}
            className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">
            <Plus size={15} /> Add a payment to the hotel / venue
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      {/* ---- Actual payment dates for one cost ---- */}
      {payFor && (() => {
        const cost = data.costs.find(c => c.id === payFor)
        if (!cost) return null
        const mine = data.costPayments.filter(p => p.costId === payFor)
        const paid = Math.round(mine.reduce((n, p) => n + p.amountAed, 0) * 100) / 100
        const left = Math.round((cost.amountAed - paid) * 100) / 100
        return (
          <div className="rounded-xl border border-gold-500/40 bg-charcoal-700/30 px-4 py-4">
            <p className="text-white text-sm font-semibold mb-1">Payments for: {cost.description}</p>
            <p className="text-gray-400 text-xs mb-3">
              Cost {aed(cost.amountAed)} AED. Paid so far {aed(paid)}. Left to pay <span className={left > 0 ? 'text-amber-300 font-semibold' : 'text-green-400 font-semibold'}>{aed(Math.max(0, left))}</span>.
              Enter each payment on the date it was actually made, so a cost paid in two parts shows twice. This does not change the cost or the profit.
            </p>
            {mine.length > 0 && (
              <ul className="divide-y divide-charcoal-700 mb-3">
                {mine.map(p => (
                  <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="text-gray-400 w-28 shrink-0">{niceDate(p.date)}</span>
                    <span className="text-white tabular-nums flex-1">{aed(p.amountAed)}</span>
                    <button onClick={() => removePayment(p.id)} disabled={busyKey === `costpay:${p.id}`} className="text-gray-500 hover:text-red-400 p-1" aria-label={`Remove payment of ${aed(p.amountAed)}`}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            {left > 0.004 ? (
              <div className="grid grid-cols-1 sm:grid-cols-[9rem_9rem_auto] gap-2 items-center">
                <input type="date" id="cp-date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} className={input} aria-label="Date the payment was made" />
                <input type="number" id="cp-amount" min="0" step="0.01" value={payForm.amountAed} placeholder="Amount (AED)"
                  onChange={e => setPayForm({ ...payForm, amountAed: e.target.value })} className={input} aria-label="Amount paid in AED" />
                <button onClick={addPayment} disabled={saving}
                  className="inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  {saving && <Loader2 size={14} className="animate-spin" />} Add payment
                </button>
              </div>
            ) : (
              <p className="text-green-400 text-sm">This cost is fully paid.</p>
            )}
            <button onClick={() => { setPayFor(null); setError('') }} className="mt-3 text-sm font-semibold text-gray-400 hover:text-white">Close</button>
          </div>
        )
      })()}

      {/* ---- Timeline ---- */}
      <div>
        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Money in and out, in date order</p>
        {flow.timeline.length === 0 ? (
          <p className="text-gray-500 text-sm">Nothing recorded yet.</p>
        ) : (
          <div className="overflow-x-auto border border-charcoal-700 rounded-lg">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-gray-500 text-xs bg-charcoal-800">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Date</th>
                  <th className="text-left font-medium px-2 py-2">What</th>
                  <th className="text-right font-medium px-2 py-2">In</th>
                  <th className="text-right font-medium px-2 py-2">Out</th>
                  <th className="text-right font-medium px-2 py-2">Running total</th>
                  <th className="text-right font-medium px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {flow.timeline.map(r => (
                  <tr key={r.key} className="border-t border-charcoal-700">
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{r.date ? niceDate(r.date) : 'Ongoing'}</td>
                    <td className={`px-2 py-2 ${r.kind === 'unscheduled' ? 'text-gray-400 italic' : 'text-white'}`}>
                      {r.description}
                      {r.line?.costId && (
                        <button onClick={() => openPayments(r.line!.costId!)} className="ml-2 text-xs text-gold-500 hover:text-gold-400 underline underline-offset-2">
                          {r.split ? 'Edit payments' : 'Payment dates'}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-green-400">{r.inAed ? aed(r.inAed) : ''}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-200">{r.outAed ? aed(r.outAed) : ''}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${r.running < 0 ? 'text-red-400' : 'text-white'}`}>{aed(r.running)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {r.line ? (
                        <button onClick={() => toggle(r)} disabled={busyKey === r.key}
                          title={r.settled ? 'Click if this has not actually happened yet' : 'Click once this has happened'}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${r.settled ? 'border-green-500/40 text-green-400 hover:bg-green-500/10' : r.overdue ? 'border-red-500/50 text-red-300 hover:bg-red-500/10' : 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10'}`}>
                          {r.overdue ? `${paidLabel(r)} (overdue)` : paidLabel(r)}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">{r.kind === 'card' ? 'Received' : 'To pay'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ul className="text-gray-500 text-xs mt-3 space-y-1 list-disc pl-4">
          <li>The running total assumes each line happens on its date. It starts at zero for this event, so it is not your bank balance.</li>
          <li>Card sales count as received when customers pay. Stripe sends the money to your bank a few days later, so the bank will lag behind.</li>
          <li>Costs and income typed under Additional revenue &amp; costs appear here as paid or received. Press a status to change one that has not really happened yet, such as Ticketsfy&rsquo;s payout.</li>
          <li>A cost paid in more than one go: press Payment dates beside it and enter each payment on the day it was made. The part not yet paid stays as its own line.</li>
        </ul>
      </div>
    </div>
  )
}
