'use client'

import { useState } from 'react'
import { Loader2, Check, Users, Minus, Plus } from 'lucide-react'
import { isValidEmail, emailProblem } from '@/lib/email-validate'
import { btnPrimary } from '@/lib/ui'

// Shown in place of the booking form once a capped event sells out. Replaces
// "email events@bild.ae", which put the request in an inbox where nobody could
// see how many were waiting or who asked first.
const MAX_TICKETS = 10

export default function WaitlistForm({ eventId, eventTitle, tickets = [] }: {
  eventId: string
  eventTitle: string
  // The ticket types on sale. With two or more, people say which they want.
  tickets?: { id: string; name: string; price_aed: number }[]
}) {
  const byType = tickets.length >= 2
  // How many of each ticket type they want, by ticket id.
  const [qty, setQty] = useState<Record<string, number>>({})
  const totalByType = Object.values(qty).reduce((s, n) => s + n, 0)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [ticketsWanted, setTicketsWanted] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [tried, setTried] = useState(false)

  async function submit() {
    setTried(true)
    setError('')
    if (!firstName.trim()) return setError('Please give your first name.')
    const mailProblem = emailProblem(email)
    if (mailProblem) return setError(mailProblem)
    if (byType && totalByType < 1) return setError('Please choose your registration type.')
    if (byType && totalByType > MAX_TICKETS) return setError(`The waiting list takes up to ${MAX_TICKETS} places per person. For more, please email events@bild.ae.`)

    setBusy(true)
    const res = await fetch('/api/events/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId, firstName, lastName, email, phone,
        ticketsWanted: byType ? totalByType : ticketsWanted,
        ...(byType ? { ticketChoices: tickets.filter(t => (qty[t.id] || 0) > 0).map(t => ({ ticketId: t.id, quantity: qty[t.id] })) } : {}),
      }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d.error || 'Could not add you to the waitlist. Please try again.')
    setDone(true)
  }

  const field = 'w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-charcoal-800 focus:outline-none focus:border-gold-500'
  const bad = (cond: boolean) => (tried && cond ? 'border-ruby-500' : 'border-gold-200')

  if (done) {
    return (
      <div className="p-6 bg-gold-50 rounded-xl border border-gold-200 text-center">
        <span className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
          <Check size={22} className="text-green-600" />
        </span>
        <p className="text-charcoal-800 font-semibold">You are on the waitlist</p>
        <p className="text-charcoal-600 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
          We have emailed you to confirm. If a place frees up we will be in touch with a link to book. Places are
          offered in the order people joined.
        </p>
        <p className="text-charcoal-600 text-xs mt-3">Nothing is reserved and nothing has been charged.</p>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gold-50 rounded-xl border border-gold-200">
      <div className="flex items-start gap-3 mb-1">
        <span className="w-10 h-10 rounded-xl bg-charcoal-800 flex items-center justify-center shrink-0">
          <Users size={19} className="text-gold-400" />
        </span>
        <div>
          <p className="text-charcoal-800 font-semibold">This event is at capacity</p>
          <p className="text-charcoal-600 text-sm">
            Join the waitlist and we will email you if a place frees up.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        <label className="block">
          <span className="text-charcoal-600 text-xs block mb-1">First name</span>
          <input value={firstName} onChange={e => setFirstName(e.target.value)}
            className={`${field} ${bad(!firstName.trim())}`} />
        </label>
        <label className="block">
          <span className="text-charcoal-600 text-xs block mb-1">Last name</span>
          <input value={lastName} onChange={e => setLastName(e.target.value)} className={`${field} border-gold-200`} />
        </label>
        <label className="block">
          <span className="text-charcoal-600 text-xs block mb-1">Email</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com"
            className={`${field} ${bad(!isValidEmail(email))}`} />
        </label>
        <label className="block">
          <span className="text-charcoal-600 text-xs block mb-1">Mobile (optional)</span>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={`${field} border-gold-200`} />
        </label>
      </div>

      {byType ? (
        <div className="mt-4">
          <p className="text-charcoal-700 text-sm font-medium mb-2">Which registration type would you like?</p>
          <div className="space-y-2">
            {tickets.map(t => {
              const n = qty[t.id] || 0
              // Changes by a step from the latest count, so quick taps are never lost.
              const step = (d: number) => setQty(q => ({ ...q, [t.id]: Math.max(0, Math.min(MAX_TICKETS, (q[t.id] || 0) + d)) }))
              return (
                <div key={t.id} className={`flex items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2.5 ${n > 0 ? 'border-gold-500' : 'border-gold-200'}`}>
                  <div className="min-w-0">
                    <p className="text-charcoal-800 text-sm font-medium truncate">{t.name}</p>
                    <p className="text-charcoal-600 text-xs">{t.price_aed > 0 ? `${t.price_aed} AED` : 'Free'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => step(-1)} disabled={n === 0} aria-label={`One fewer ${t.name}`}
                      className="w-8 h-8 rounded-full border border-gold-200 flex items-center justify-center text-charcoal-700 disabled:opacity-30"><Minus size={14} /></button>
                    <span className="w-6 text-center text-sm font-semibold text-charcoal-800" aria-live="polite">{n}</span>
                    <button type="button" onClick={() => step(1)} disabled={totalByType >= MAX_TICKETS} aria-label={`One more ${t.name}`}
                      className="w-8 h-8 rounded-full border border-gold-200 flex items-center justify-center text-charcoal-700 disabled:opacity-30"><Plus size={14} /></button>
                  </div>
                </div>
              )
            })}
          </div>
          <p className={`text-xs mt-2 ${tried && totalByType < 1 ? 'text-ruby-500' : 'text-charcoal-600'}`}>
            {totalByType < 1 ? 'Choose at least one place. You can mix types.' : `${totalByType} place${totalByType === 1 ? '' : 's'} in total.`}
          </p>
        </div>
      ) : (
        <label className="block mt-3 max-w-[14rem]">
          <span className="text-charcoal-600 text-xs block mb-1">How many places do you need?</span>
          <select
            value={ticketsWanted}
            onChange={e => setTicketsWanted(Number(e.target.value))}
            className={`${field} border-gold-200`}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'place' : 'places'}</option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="text-ruby-500 text-sm mt-3">{error}</p>}

      <button onClick={submit} disabled={busy} className={`${btnPrimary} w-full mt-5 py-3 text-base`}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : null}
        {busy ? 'Adding you...' : 'Join the waitlist'}
      </button>

      <p className="text-charcoal-600 text-xs mt-3 text-center leading-relaxed">
        Joining the list does not reserve a place and nothing is charged. We will only use these details to contact
        you about <span className="text-charcoal-600">{eventTitle}</span>.
      </p>
    </div>
  )
}
