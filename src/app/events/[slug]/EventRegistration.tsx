'use client'

import { useState, useRef } from 'react'
import { Ticket, Loader2, Minus, Plus } from 'lucide-react'
import { EventTicket, Dietary } from '@/lib/events'
import { cardFeeAed } from '@/lib/fees'
import { isValidEmail } from '@/lib/email-validate'
import WaitlistForm from './WaitlistForm'

// One booking can hold this many people in total, across every package.
// It used to be 10 per package with no total at all in the browser, while the
// checkout quietly kept only the first 9 guests. Anyone booking ten adults and
// then adding children had the children silently dropped on the way to payment,
// which is exactly how it looked to the buyer: the child tickets would not go
// through. The ceiling is now one number, shown on the page and enforced in
// both places.
const MAX_TICKETS_PER_BOOKING = 20
const errBorder = 'border-ruby-500 ring-1 ring-ruby-300'

type MiniEvent = { id: string; slug: string; title: string }
type Attendee = { name: string; dietary: Dietary; dietaryNote: string; age: string }

// A child ticket asks for the child's age. Kept as a string in state so the
// field can be genuinely empty rather than defaulting to 0, which would let a
// booking through with an age nobody typed.
const MAX_CHILD_AGE = 17
function ageInvalid(v: string) {
  const n = Number(v)
  return v.trim() === '' || !Number.isInteger(n) || n < 0 || n > MAX_CHILD_AGE
}

function priceLabel(t: EventTicket) {
  return t.price_aed === 0 ? 'Free' : `${t.price_aed} AED`
}

// `soldOut` rather than the remaining count, deliberately.
//
// Anything passed to a client component is serialised into the page source,
// so sending the number would have left it readable by anyone viewing source
// even though nothing displayed it. Capacity is enforced on the server at
// checkout, which is the only place it can be enforced anyway.
export default function EventRegistration({ event, tickets, soldOut, waitlistOpen, dietaryRequired }: {
  event: MiniEvent; tickets: EventTicket[]; soldOut?: boolean; waitlistOpen?: boolean; dietaryRequired?: boolean
}) {
  // attendees[ticketId] = array of { name, dietary } for that package (length = qty)
  const [attendeesByTicket, setAttendeesByTicket] = useState<Record<string, Attendee[]>>({})
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  if (tickets.length === 0) {
    return (
      <div className="p-6 bg-gold-50 rounded-xl border border-gold-100">
        <p className="text-charcoal-700 font-medium">Registration for this event isn&rsquo;t open yet.</p>
        <p className="text-charcoal-500 text-sm mt-1">Check back soon or email events@bild.ae.</p>
      </div>
    )
  }

  // A sold-out capped event offers the waitlist; one without a cap cannot
  // sell out, so it never reaches here.
  if (soldOut && waitlistOpen) {
    return <WaitlistForm eventId={event.id} eventTitle={event.title} />
  }

  if (soldOut) {
    return (
      <div className="p-6 bg-gold-50 rounded-xl border border-gold-100">
        <p className="text-charcoal-700 font-medium">This event is sold out.</p>
        <p className="text-charcoal-500 text-sm mt-1">The waitlist is closed. Email events@bild.ae if you need help.</p>
      </div>
    )
  }

  const count = (id: string) => attendeesByTicket[id]?.length || 0
  const totalTickets = tickets.reduce((s, t) => s + count(t.id), 0)
  const subtotal = tickets.reduce((s, t) => s + t.price_aed * count(t.id), 0)
  const cardFee = cardFeeAed(subtotal)
  const grandTotal = subtotal + cardFee
  const money = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2))

  function inc(id: string) {
    setAttendeesByTicket(prev => {
      const cur = prev[id] || []
      const total = Object.values(prev).reduce((n, a) => n + a.length, 0)
      if (total >= MAX_TICKETS_PER_BOOKING) return prev
      return { ...prev, [id]: [...cur, { name: '', dietary: '', dietaryNote: '', age: '' }] }
    })
  }
  function dec(id: string) {
    setAttendeesByTicket(prev => {
      const cur = prev[id] || []
      if (cur.length === 0) return prev
      return { ...prev, [id]: cur.slice(0, -1) }
    })
  }
  function setName(id: string, i: number, v: string) {
    setAttendeesByTicket(prev => ({ ...prev, [id]: (prev[id] || []).map((a, idx) => (idx === i ? { ...a, name: v } : a)) }))
  }
  function setDietary(id: string, i: number, v: Dietary) {
    setAttendeesByTicket(prev => ({ ...prev, [id]: (prev[id] || []).map((a, idx) => (idx === i ? { ...a, dietary: v, dietaryNote: v === 'other' ? a.dietaryNote : '' } : a)) }))
  }
  function setDietaryNote(id: string, i: number, v: string) {
    setAttendeesByTicket(prev => ({ ...prev, [id]: (prev[id] || []).map((a, idx) => (idx === i ? { ...a, dietaryNote: v } : a)) }))
  }
  function setAge(id: string, i: number, v: string) {
    setAttendeesByTicket(prev => ({ ...prev, [id]: (prev[id] || []).map((a, idx) => (idx === i ? { ...a, age: v } : a)) }))
  }

  const isEmail = isValidEmail

  async function register() {
    setError('')
    setTried(true)
    if (totalTickets === 0) return setError('Please add at least one ticket.')

    // Flatten to an ordered attendee list: [{ name, dietary, dietaryNote, ticketId }]
    const attendees: { name: string; dietary: Dietary; dietaryNote: string; ticketId: string; age: number | null }[] = []
    for (const t of tickets) {
      for (const a of attendeesByTicket[t.id] || []) {
        attendees.push({
          name: a.name.trim(),
          dietary: a.dietary,
          dietaryNote: a.dietaryNote.trim(),
          ticketId: t.id,
          age: t.is_child ? Number(a.age) : null,
        })
      }
    }
    const missingName = attendees.some(a => !a.name)
    const missingAge = tickets.some(t => t.is_child && (attendeesByTicket[t.id] || []).some(a => ageInvalid(a.age)))
    const missingEmail = !isEmail(email)
    if (missingName || missingAge || missingEmail) {
      setError(
        missingName ? 'Please enter the full name of every attendee.'
          : missingAge ? `Please enter an age between 0 and ${MAX_CHILD_AGE} for every child ticket.`
          : 'Please enter a valid email address for your confirmation.',
      )
      // setTimeout rather than requestAnimationFrame: rAF is throttled/paused
      // for backgrounded or non-foreground tabs, which would silently drop
      // this scroll for anyone not actively focused on the tab at that instant.
      setTimeout(() => {
        const firstInvalid = formRef.current?.querySelector(`.${errBorder.split(' ')[0]}`)
        firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 0)
      return
    }

    // First attendee is the lead booker; the rest are guests.
    const lead = attendees[0]
    const parts = lead.name.split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ')

    setLoading(true)
    try {
      const res = await fetch('/api/events/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          ticketId: lead.ticketId,
          firstName,
          lastName,
          email: email.trim(),
          phone: phone.trim(),
          dietary: lead.dietary,
          dietaryNote: lead.dietaryNote,
          age: lead.age,
          guests: attendees.slice(1).map(a => ({ name: a.name, ticketId: a.ticketId, dietary: a.dietary, dietaryNote: a.dietaryNote, age: a.age })),
        }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const selectedTickets = tickets.filter(t => count(t.id) > 0)
  let attendeeNo = 0

  return (
    <div ref={formRef} className="p-6 sm:p-8 bg-white rounded-2xl border border-gold-100 shadow-card">
      <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-1 flex items-center gap-2">
        <Ticket size={22} className="text-gold-500" /> Register for this event
      </h2>
      <p className="text-charcoal-500 text-sm mb-6">Choose how many tickets you need, name each guest, and pay securely via Stripe.</p>

      {/* Step 1 - choose tickets */}
      {/* The number of tickets left is deliberately not shown. It is still
          used to cap the booking and to show a sold-out state, but a public
          countdown tells people how an event is selling. */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">Step 1 · Choose your tickets</p>
      </div>
      {totalTickets >= MAX_TICKETS_PER_BOOKING && (
        <p className="text-sm text-charcoal-600 mb-3">
          That is the most we can take on one booking. For a larger group, book again or email{' '}
          <a href="mailto:events@bild.ae" className="text-gold-600 font-medium hover:underline">events@bild.ae</a> and we
          will sort it out for you.
        </p>
      )}
      <div className="space-y-3 mb-8">
        {tickets.map(t => (
          <div key={t.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-charcoal-200">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-charcoal-800">{t.name}</span>
                <span className="font-display font-bold text-charcoal-800">{priceLabel(t)}</span>
              </div>
              {t.description && <p className="text-sm text-charcoal-500 mt-0.5">{t.description}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button" onClick={() => dec(t.id)} disabled={count(t.id) === 0}
                className="h-9 w-9 rounded-lg border border-charcoal-300 text-charcoal-700 flex items-center justify-center hover:bg-charcoal-100 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={`Fewer ${t.name}`}
              >
                <Minus size={16} />
              </button>
              <span className="w-6 text-center font-display text-lg font-bold text-charcoal-800">{count(t.id)}</span>
              <button
                type="button" onClick={() => inc(t.id)} disabled={totalTickets >= MAX_TICKETS_PER_BOOKING}
                className="h-9 w-9 rounded-lg border border-charcoal-300 text-charcoal-700 flex items-center justify-center hover:bg-charcoal-100 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={`More ${t.name}`}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Step 2 - name each attendee */}
      {totalTickets > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-600 mb-2">Step 2 · Who&rsquo;s attending?</p>
          <p className="text-sm text-charcoal-500 mb-4">
            We check everyone in by name at the door, so please give the full name of each person attending{selectedTickets.some(t => t.is_child) ? ', and the age of each child' : ''}{dietaryRequired ? ', and let us know of any dietary requirements' : ''}.
          </p>
          <div className="space-y-5 mb-8">
            {selectedTickets.map(t => (
              <div key={t.id}>
                <p className="text-sm font-semibold text-charcoal-700 mb-2">
                  {t.name} <span className="text-charcoal-400 font-normal">· {count(t.id)} {count(t.id) === 1 ? 'ticket' : 'tickets'}</span>
                </p>
                <div className="space-y-4">
                  {(attendeesByTicket[t.id] || []).map((a, i) => {
                    attendeeNo += 1
                    const isLead = attendeeNo === 1
                    const invalid = tried && !a.name.trim()
                    const badAge = tried && t.is_child && ageInvalid(a.age)
                    return (
                      <div key={i} className={`space-y-2 ${count(t.id) > 1 ? 'pb-4 border-b border-charcoal-100 last:pb-0 last:border-0' : ''}`}>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={a.name}
                            onChange={e => setName(t.id, i, e.target.value)}
                            placeholder={isLead ? 'Your full name' : 'Guest full name'}
                            className={`flex-1 px-4 py-3 bg-white border rounded-xl text-charcoal-800 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 ${invalid ? errBorder : 'border-charcoal-200'}`}
                          />
                          {t.is_child && (
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={MAX_CHILD_AGE}
                              value={a.age}
                              onChange={e => setAge(t.id, i, e.target.value)}
                              placeholder="Age"
                              aria-label={`Age of child ${i + 1} on ${t.name}`}
                              className={`px-4 py-3 bg-white border rounded-xl text-charcoal-800 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 sm:w-28 shrink-0 ${badAge ? errBorder : 'border-charcoal-200'}`}
                            />
                          )}
                          {dietaryRequired && (
                            <select
                              value={a.dietary}
                              onChange={e => setDietary(t.id, i, e.target.value as Dietary)}
                              className="px-3 py-3 bg-white border border-charcoal-200 rounded-xl text-charcoal-800 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 sm:w-40 shrink-0"
                            >
                              <option value="">No dietary preference</option>
                              <option value="vegetarian">Vegetarian</option>
                              <option value="vegan">Vegan</option>
                              <option value="other">Other</option>
                            </select>
                          )}
                        </div>
                        {dietaryRequired && a.dietary === 'other' && (
                          <input
                            type="text"
                            value={a.dietaryNote}
                            onChange={e => setDietaryNote(t.id, i, e.target.value)}
                            placeholder="Please specify (e.g. gluten free, nut allergy)"
                            className="w-full px-4 py-2.5 bg-white border border-charcoal-200 rounded-xl text-charcoal-800 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Step 3 - contact */}
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-600 mb-2">Step 3 · Your contact details</p>
          <p className="text-sm text-charcoal-500 mb-3">Your ticket confirmation is emailed here.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" type="email" invalid={tried && !isEmail(email)} />
            <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+971 50 000 0000" />
          </div>
        </>
      )}

      {/* Price breakdown */}
      {totalTickets > 0 && subtotal > 0 && (
        <div className="rounded-xl border border-charcoal-200 bg-charcoal-50/50 p-4 mb-5 text-sm">
          <div className="flex justify-between text-charcoal-600">
            <span>Tickets ({totalTickets})</span>
            <span>{money(subtotal)} AED</span>
          </div>
          <div className="flex justify-between text-charcoal-600 mt-1.5">
            <span>Card processing fee</span>
            <span>{money(cardFee)} AED</span>
          </div>
          <div className="flex justify-between font-semibold text-charcoal-800 border-t border-charcoal-200 mt-2.5 pt-2.5">
            <span>Total</span>
            <span>{money(grandTotal)} AED</span>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <button
        onClick={register}
        disabled={loading || totalTickets === 0}
        className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-b from-gold-400 to-gold-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <><Loader2 size={20} className="animate-spin" /> Redirecting to payment...</>
        ) : totalTickets === 0 ? (
          <>Add a ticket to continue</>
        ) : (
          <>Pay {grandTotal > 0 ? `${money(grandTotal)} AED` : ''} &amp; register{totalTickets > 1 ? ` · ${totalTickets} tickets` : ''}</>
        )}
      </button>
      <p className="text-center text-charcoal-400 text-xs mt-3">Secure payment powered by Stripe. A confirmation is emailed to you.</p>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', invalid,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; invalid?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-charcoal-500 uppercase tracking-wide mb-1 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 bg-white border rounded-xl text-charcoal-800 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 ${invalid ? errBorder : 'border-charcoal-200'}`}
      />
    </div>
  )
}
