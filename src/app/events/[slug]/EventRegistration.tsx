'use client'

import { useState, useRef, useEffect } from 'react'
import { Ticket, Loader2, Minus, Plus, Users, Image as ImageIcon } from 'lucide-react'
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
type Attendee = { name: string; title: string; dietary: Dietary; dietaryNote: string; age: string }

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
export default function EventRegistration({ event, tickets, soldOut, waitlistOpen, dietaryRequired, seatingEnabled }: {
  event: MiniEvent; tickets: EventTicket[]; soldOut?: boolean; waitlistOpen?: boolean; dietaryRequired?: boolean; seatingEnabled?: boolean
}) {
  // attendees[ticketId] = array of { name, dietary } for that package (length = qty)
  const [attendeesByTicket, setAttendeesByTicket] = useState<Record<string, Attendee[]>>({})
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  // Table seating: an optional code that groups this booking with a friend's.
  // Checked live against the server as it is typed, debounced, so a typo is
  // caught before payment rather than the admin team discovering it a day
  // before the event.
  const [seatingCode, setSeatingCode] = useState('')
  const [seatingCheck, setSeatingCheck] = useState<'idle' | 'checking' | 'found' | 'notfound'>('idle')
  const [seatingOrganiser, setSeatingOrganiser] = useState('')
  const [seatingHeadcount, setSeatingHeadcount] = useState<number | null>(null)
  const [seatsPerTable, setSeatsPerTable] = useState<number | null>(null)
  // True only while the code in the box is the one that arrived on a shared
  // link, untouched. It exists so somebody who did not choose to be grouped -
  // the link was forwarded further than the organiser intended, or they would
  // simply rather sit elsewhere - can be told plainly that clearing the box is
  // a normal thing to do, not typed themselves so it never applies to a code
  // somebody entered on purpose.
  const [codeFromLink, setCodeFromLink] = useState(false)
  // Cosmetic only: collapses the "did you mean to join this table?" question
  // once someone has confirmed they want to stay, so it does not keep asking.
  const [referralAnsweredStaying, setReferralAnsweredStaying] = useState(false)
  // Shown once, as a small acknowledgement, the first time someone arrives via
  // a table link and then chooses to leave it - without this the referral
  // banner would simply vanish with no confirmation that the choice was heard.
  const [justLeftTable, setJustLeftTable] = useState(false)

  // A code arriving on the link an organiser shared (?table=AC4NR) pre-fills
  // the box, so a friend who follows that link never has to type or copy
  // anything - the whole point of giving them a link rather than just a code.
  // Plain browser APIs on mount rather than useSearchParams, which would need
  // a Suspense boundary around this component for no real benefit here.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('table')
    if (fromLink) { setSeatingCode(fromLink.toUpperCase()); setCodeFromLink(true) }
  }, [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  // Debounced: a check on every keystroke would hit the endpoint constantly
  // while someone is still mid-code.
  useEffect(() => {
    const code = seatingCode.trim()
    if (!code) { setSeatingCheck('idle'); return }
    setSeatingCheck('checking')
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/seating-check?eventId=${event.id}&code=${encodeURIComponent(code)}`)
        const data = await res.json()
        if (data.found) {
          setSeatingOrganiser(data.organiserFirstName)
          setSeatingHeadcount(typeof data.headcount === 'number' ? data.headcount : null)
          setSeatsPerTable(typeof data.seatsPerTable === 'number' ? data.seatsPerTable : null)
          setSeatingCheck('found')
        } else {
          setSeatingCheck('notfound')
        }
      } catch {
        setSeatingCheck('idle')
      }
    }, 500)
    return () => clearTimeout(t)
  }, [seatingCode, event.id])

  // Two entirely different forms live in this one component, chosen by how
  // the visitor arrived, not by anything they fill in. Someone who followed a
  // table-invite link already knows why they are here - the banner leads with
  // that, and the ordinary ticket-buying copy stays out of their way entirely.
  // Everyone else (nobody sent them a link, or they said they would rather
  // not join it) gets the plain form, unchanged. A code that turned out not to
  // exist falls through to the plain form too, so a broken or mistyped link
  // still leaves someone able to book rather than stuck looking at a banner
  // for a table that is not real.
  const isReferralFlow = !!seatingEnabled && codeFromLink && seatingCheck !== 'notfound'

  function stayOnTable() {
    setReferralAnsweredStaying(true)
  }
  function leaveTable() {
    setSeatingCode('')
    setCodeFromLink(false)
    setReferralAnsweredStaying(false)
    setJustLeftTable(true)
  }

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

  // Whether ANY ticket on this event could cost something - decided before a
  // ticket is even chosen, so it can only look at what tickets exist, not what
  // the buyer will pick. An event where every ticket is free never mentions
  // payment at all; one with even a single priced ticket keeps the mention,
  // since picking that one is still possible.
  const eventCanCostMoney = tickets.some(t => t.price_aed > 0)

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
      return { ...prev, [id]: [...cur, { name: '', title: '', dietary: '', dietaryNote: '', age: '' }] }
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
  function setTitle(id: string, i: number, v: string) {
    setAttendeesByTicket(prev => ({ ...prev, [id]: (prev[id] || []).map((a, idx) => (idx === i ? { ...a, title: v } : a)) }))
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
    const attendees: { name: string; title: string; dietary: Dietary; dietaryNote: string; ticketId: string; age: number | null }[] = []
    for (const t of tickets) {
      for (const a of attendeesByTicket[t.id] || []) {
        attendees.push({
          name: a.name.trim(),
          title: a.title,
          dietary: a.dietary,
          dietaryNote: a.dietaryNote.trim(),
          ticketId: t.id,
          age: t.is_child ? Number(a.age) : null,
        })
      }
    }
    const missingName = attendees.some(a => !a.name)
    const missingTitle = attendees.some(a => !a.title)
    const missingAge = tickets.some(t => t.is_child && (attendeesByTicket[t.id] || []).some(a => ageInvalid(a.age)))
    const missingEmail = !isEmail(email)
    const badSeatingCode = seatingEnabled && seatingCheck === 'notfound'
    if (missingName || missingTitle || missingAge || missingEmail || badSeatingCode) {
      setError(
        missingName ? 'Please enter the full name of every attendee.'
          : missingTitle ? 'Please choose a title (Mr./Mrs./Miss) for every attendee.'
          : missingAge ? `Please enter an age between 0 and ${MAX_CHILD_AGE} for every child ticket.`
          : missingEmail ? 'Please enter a valid email address for your confirmation.'
          : 'That table code was not found. Please check it or clear the field.',
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
          title: lead.title || undefined,
          email: email.trim(),
          phone: phone.trim(),
          dietary: lead.dietary,
          dietaryNote: lead.dietaryNote,
          age: lead.age,
          guests: attendees.slice(1).map(a => ({ name: a.name, title: a.title || undefined, ticketId: a.ticketId, dietary: a.dietary, dietaryNote: a.dietaryNote, age: a.age })),
          seatingCode: seatingEnabled ? seatingCode.trim() : undefined,
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
      {/* The referral form. Only for someone who arrived on a table-invite
          link, and only while their code still checks out - see isReferralFlow
          above. Leads with why they are here rather than making them find it
          part-way down an ordinary ticket form. */}
      {isReferralFlow && (
        <div className="mb-6 p-4 rounded-xl border border-gold-200 bg-gold-50/50">
          {seatingCheck === 'checking' && <p className="text-sm text-charcoal-500">Checking your invite...</p>}
          {seatingCheck === 'found' && (
            <>
              <p className="flex items-center gap-1.5 text-base font-semibold text-green-700">
                <Users size={16} className="text-gold-600 shrink-0" /> You&rsquo;ll be joining {seatingOrganiser}&rsquo;s table.
              </p>
              {seatingHeadcount != null && seatsPerTable != null && (
                <p className="text-charcoal-500 text-xs mt-1.5">
                  {seatingHeadcount >= seatsPerTable
                    ? `This table already has its full ${seatsPerTable} seats claimed - book anyway and we'll start a fresh table for your group instead.`
                    : `${seatingHeadcount} of ${seatsPerTable} seats already claimed for this table.`}
                </p>
              )}
              <p className="text-charcoal-500 text-xs italic mt-1.5">
                Seating with friends can be requested, and while we will try our best, it cannot be guaranteed.
              </p>
              {referralAnsweredStaying ? (
                <p className="text-charcoal-500 text-xs mt-3 pt-3 border-t border-gold-200">
                  Great - carry on below and you&rsquo;ll be seated with them.
                </p>
              ) : (
                <div className="mt-3 pt-3 border-t border-gold-200">
                  <p className="text-sm text-charcoal-700 mb-2">
                    Didn&rsquo;t mean to join this table, or would rather sit elsewhere?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={stayOnTable}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-gold-500 text-white hover:bg-gold-600 transition-colors"
                    >
                      No, keep me here
                    </button>
                    <button
                      type="button"
                      onClick={leaveTable}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-charcoal-300 text-charcoal-700 hover:bg-charcoal-100 transition-colors"
                    >
                      Yes, seat me elsewhere
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-1 flex items-center gap-2">
        <Ticket size={22} className="text-gold-500" /> Register for this event
      </h2>
      <p className="text-charcoal-500 text-sm mb-6">
        Choose how many tickets you need, name each guest{eventCanCostMoney ? ', and pay securely via Stripe' : ''}.
      </p>

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
              {t.menu_image_url && (
                <a
                  href={t.menu_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-gold-600 hover:underline text-xs font-medium mt-1"
                >
                  <ImageIcon size={12} /> View menu
                </a>
              )}
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
            We check everyone in by name at the door, so please choose a title and give the full name of each person attending{selectedTickets.some(t => t.is_child) ? ', and the age of each child' : ''}{dietaryRequired ? ', and let us know of any dietary requirements' : ''}.
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
                    const missingTitle = tried && !a.title
                    const badAge = tried && t.is_child && ageInvalid(a.age)
                    return (
                      <div key={i} className={`space-y-2 ${count(t.id) > 1 ? 'pb-4 border-b border-charcoal-100 last:pb-0 last:border-0' : ''}`}>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={a.title}
                            onChange={e => setTitle(t.id, i, e.target.value)}
                            aria-label={`Title for ${isLead ? 'you' : `guest ${i + 1}`}`}
                            className={`px-3 py-3 bg-white border rounded-xl text-charcoal-800 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 sm:w-24 shrink-0 ${missingTitle ? errBorder : 'border-charcoal-200'}`}
                          >
                            <option value="" disabled>Title</option>
                            <option value="Mr.">Mr.</option>
                            <option value="Mrs.">Mrs.</option>
                            <option value="Miss">Miss</option>
                          </select>
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

          {/* The ordinary form: nobody sent this visitor a table link, or they
              were sent one and chose not to join it. Never shown at the same
              time as the referral banner above - see isReferralFlow. */}
          {seatingEnabled && !isReferralFlow && (
            <div className="mt-4 p-4 rounded-xl border border-gold-200 bg-gold-50/50">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-800 mb-2">
                <Users size={15} className="text-gold-600" /> This event has table seating
              </p>
              <div className="text-xs text-charcoal-600 leading-relaxed space-y-1.5 mb-3">
                {justLeftTable && (
                  <p className="font-medium text-charcoal-700">
                    No problem - you&rsquo;ll be booked in as normal and seated wherever there&rsquo;s room.
                  </p>
                )}
                <p>
                  Here&rsquo;s how it works: if you&rsquo;re the first in your group to book, leave the box below
                  empty. Once you&rsquo;ve paid, we&rsquo;ll email you a short table code, along with a ready-made
                  WhatsApp message you can send straight to anyone you&rsquo;d like at your table - just tap to
                  share, no copying or typing needed. When they book, they enter the same code in this box, and
                  everyone who enters it is seated together.
                </p>
                <p>
                  Already have a code from a friend who booked first? Enter it below instead of leaving it empty,
                  and you&rsquo;ll join their table rather than starting a new one.
                </p>
                <p className="italic text-charcoal-500">
                  Seating with friends can be requested, and while we will try our best, it cannot be guaranteed.
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-charcoal-500 uppercase tracking-wide mb-1 font-medium">
                Table code (optional)
              </label>
              <input
                type="text"
                value={seatingCode}
                onChange={e => { setSeatingCode(e.target.value.toUpperCase()); setCodeFromLink(false) }}
                placeholder="e.g. AC4NR - leave blank if you don't have one"
                maxLength={12}
                className={`w-full px-4 py-3 bg-white border rounded-xl text-charcoal-800 text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-gold-500 ${
                  seatingCheck === 'notfound' ? errBorder : 'border-charcoal-200'
                }`}
              />
              <div className="text-xs mt-1.5">
                {seatingCheck === 'checking' && <span className="text-charcoal-400">Checking...</span>}
                {seatingCheck === 'found' && (
                  <>
                    <p className="text-green-700 font-medium">You&rsquo;ll be joining {seatingOrganiser}&rsquo;s table.</p>
                    {seatingHeadcount != null && seatsPerTable != null && (
                      <p className="text-charcoal-500 mt-0.5">
                        {seatingHeadcount >= seatsPerTable
                          ? `This table already has its full ${seatsPerTable} seats claimed - book anyway and we'll start a fresh table for your group instead.`
                          : `${seatingHeadcount} of ${seatsPerTable} seats already claimed for this table.`}
                      </p>
                    )}
                  </>
                )}
                {seatingCheck === 'notfound' && (
                  <span className="text-ruby-600">
                    {codeFromLink
                      ? 'The invite link you used does not match a table we recognise for this event. Check it with your friend, or leave it blank.'
                      : 'We can’t find that code for this event. Check it with your friend, or leave it blank.'}
                  </span>
                )}
              </div>
            </div>
          )}
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
          <p className="text-charcoal-400 text-xs italic mt-1">
            Card processing fee - charged by the payment provider. BILD does not receive this fee.
          </p>
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
          grandTotal > 0
            ? <><Loader2 size={20} className="animate-spin" /> Redirecting to payment...</>
            : <><Loader2 size={20} className="animate-spin" /> Registering...</>
        ) : totalTickets === 0 ? (
          <>Add a ticket to continue</>
        ) : grandTotal > 0 ? (
          <>Pay {money(grandTotal)} AED &amp; register{totalTickets > 1 ? ` · ${totalTickets} tickets` : ''}</>
        ) : (
          <>Register{totalTickets > 1 ? ` · ${totalTickets} tickets` : ''}</>
        )}
      </button>
      <p className="text-center text-charcoal-400 text-xs mt-3">
        {grandTotal > 0 ? 'Secure payment powered by Stripe. A confirmation is emailed to you.' : 'A confirmation is emailed to you.'}
      </p>
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
