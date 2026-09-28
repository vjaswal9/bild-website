'use client'

import { useState, useMemo } from 'react'
import { Star, Loader2, Mail, Calendar, MapPin, CheckCircle2 } from 'lucide-react'

export type Booking = {
  registrationId: string
  buyerName: string
  email: string
  partySize: number
  guestNames: string[]
  // Most recent time anyone (the paused automated cron, or an admin using
  // this page) already asked this booking for a review, if ever.
  lastAskedAt: string | null
}

export type EventGroup = {
  eventId: string
  title: string
  venue: string | null
  eventDate: string
  isPast: boolean
  bookings: Booking[]
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Selection is keyed by registrationId across every event on the page, so
// "Send to selected" works as one action regardless of how many events an
// admin has ticked bookings across.
export default function ReviewRequestsAdmin({ groups }: { groups: EventGroup[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: string[]; failed: { email: string; error: string }[] } | null>(null)
  const [openEventId, setOpenEventId] = useState<string | null>(groups[0]?.eventId ?? null)

  const bookingById = useMemo(() => {
    const m = new Map<string, Booking & { eventId: string }>()
    for (const g of groups) for (const b of g.bookings) m.set(b.registrationId, { ...b, eventId: g.eventId })
    return m
  }, [groups])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllInEvent(g: EventGroup, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      for (const b of g.bookings) {
        if (checked) next.add(b.registrationId)
        else next.delete(b.registrationId)
      }
      return next
    })
  }

  async function send() {
    if (selected.size === 0) return
    if (!confirm(`Send the Google review request email to ${selected.size} ${selected.size === 1 ? 'person' : 'people'}?`)) return
    setSending(true)
    setResult(null)
    const items = Array.from(selected).map(id => {
      const b = bookingById.get(id)!
      return { eventId: b.eventId, registrationId: id }
    })
    try {
      const res = await fetch('/api/admin/events/send-review-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const d = await res.json()
      if (res.ok) {
        setResult({ sent: d.sent || [], failed: d.failed || [] })
        setSelected(new Set())
      } else {
        alert(d.error || 'Could not send.')
      }
    } catch {
      alert('Network error.')
    }
    setSending(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <Star size={22} className="text-gold-400 fill-gold-400" /> Send Google Review Requests
        </h1>
      </div>
      <p className="text-gray-400 text-sm mb-6 max-w-2xl">
        Tick whoever you want to ask, per event, and send. Each booking is one email address, so a party of six
        booked together sends one email to whoever booked it - there is no separate address for each guest.
        The automated version of this is currently paused; this page is the manual replacement.
      </p>

      {result && (
        <div className="mb-6 rounded-xl border border-green-600/40 bg-green-600/10 px-4 py-3">
          <p className="text-green-300 text-sm font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={15} /> Sent to {result.sent.length} {result.sent.length === 1 ? 'person' : 'people'}.
          </p>
          {result.failed.length > 0 && (
            <p className="text-red-300 text-xs mt-1.5">
              Could not send to: {result.failed.map(f => `${f.email} (${f.error})`).join(', ')}
            </p>
          )}
        </div>
      )}

      {groups.length === 0 && <p className="text-gray-500 text-sm">No paid bookings on any event yet.</p>}

      <div className="space-y-3">
        {groups.map(g => {
          const isOpen = openEventId === g.eventId
          const selectedInEvent = g.bookings.filter(b => selected.has(b.registrationId)).length
          const allSelected = selectedInEvent === g.bookings.length
          return (
            <div key={g.eventId} className="bg-charcoal-800 rounded-2xl border border-charcoal-700 overflow-hidden">
              <button
                onClick={() => setOpenEventId(isOpen ? null : g.eventId)}
                className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-charcoal-700/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-white font-semibold flex items-center gap-2 flex-wrap">
                    {g.title}
                    {!g.isPast && <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Upcoming</span>}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(g.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' })}</span>
                    {g.venue && <span className="flex items-center gap-1"><MapPin size={12} /> {g.venue}</span>}
                    <span>{g.bookings.length} {g.bookings.length === 1 ? 'booking' : 'bookings'}</span>
                  </p>
                </div>
                {selectedInEvent > 0 && (
                  <span className="shrink-0 text-xs font-semibold bg-gold-500/20 text-gold-300 px-2.5 py-1 rounded-full">{selectedInEvent} selected</span>
                )}
              </button>

              {isOpen && (
                <div className="border-t border-charcoal-700 px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-400 mb-3 cursor-pointer">
                    <input type="checkbox" checked={allSelected} onChange={e => toggleAllInEvent(g, e.target.checked)} className="h-3.5 w-3.5 accent-gold-500" />
                    Select all in this event
                  </label>
                  <div className="space-y-1.5">
                    {g.bookings.map(b => (
                      <label
                        key={b.registrationId}
                        className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-charcoal-700/40 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(b.registrationId)}
                          onChange={() => toggle(b.registrationId)}
                          className="mt-1 h-4 w-4 accent-gold-500 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium flex items-center gap-2 flex-wrap">
                            {b.buyerName}
                            {b.partySize > 1 && <span className="text-gray-400 text-xs font-normal">+{b.partySize - 1} {b.partySize - 1 === 1 ? 'guest' : 'guests'}</span>}
                            {b.lastAskedAt && (
                              <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                already asked {timeAgo(b.lastAskedAt)}
                              </span>
                            )}
                          </p>
                          <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                            <Mail size={11} /> {b.email}
                            {b.guestNames.length > 0 && <span className="ml-2 truncate">with {b.guestNames.join(', ')}</span>}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-charcoal-800 border-t border-charcoal-700 px-4 py-3 flex items-center justify-center gap-3 z-10">
          <span className="text-white text-sm">{selected.size} {selected.size === 1 ? 'person' : 'people'} selected</span>
          <button
            onClick={send}
            disabled={sending}
            className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Send review request
          </button>
          <button onClick={() => setSelected(new Set())} disabled={sending} className="text-gray-400 hover:text-white text-sm">
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
