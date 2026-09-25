'use client'

import { useState } from 'react'
import { Loader2, Check, Users } from 'lucide-react'
import { isValidEmail, emailProblem } from '@/lib/email-validate'
import { btnPrimary } from '@/lib/ui'

// Shown in place of the booking form once a capped event sells out. Replaces
// "email events@bild.ae", which put the request in an inbox where nobody could
// see how many were waiting or who asked first.
export default function WaitlistForm({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
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

    setBusy(true)
    const res = await fetch('/api/events/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, firstName, lastName, email, phone, ticketsWanted }),
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
        <p className="text-charcoal-500 text-xs mt-3">Nothing is reserved and nothing has been charged.</p>
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
          <p className="text-charcoal-800 font-semibold">This event is sold out</p>
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

      <label className="block mt-3 max-w-[14rem]">
        <span className="text-charcoal-600 text-xs block mb-1">How many tickets do you need?</span>
        <select
          value={ticketsWanted}
          onChange={e => setTicketsWanted(Number(e.target.value))}
          className={`${field} border-gold-200`}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>{n} {n === 1 ? 'ticket' : 'tickets'}</option>
          ))}
        </select>
      </label>

      {error && <p className="text-ruby-500 text-sm mt-3">{error}</p>}

      <button onClick={submit} disabled={busy} className={`${btnPrimary} w-full mt-5 py-3 text-base`}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : null}
        {busy ? 'Adding you...' : 'Join the waitlist'}
      </button>

      <p className="text-charcoal-500 text-xs mt-3 text-center leading-relaxed">
        Joining the list does not reserve a place and nothing is charged. We will only use these details to contact
        you about <span className="text-charcoal-600">{eventTitle}</span>.
      </p>
    </div>
  )
}
