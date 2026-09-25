'use client'

import { useState, useEffect, useRef } from 'react'
import { uploadViaSignedUrl } from '@/lib/upload-client'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminNav from '@/components/admin/AdminNav'
import { compressImage } from '@/lib/compress-image'
import { EventRow, EventTicket, EventRegistration, GalleryItem, isPastEvent } from '@/lib/events'
import { EVENT_COST_CATEGORIES, EVENT_REVENUE_KINDS } from '@/lib/money'
import {
  Plus, Calendar, MapPin, Ticket, Users, Image as ImageIcon, Trash2, Save, X,
  ChevronDown, ChevronUp, Download, Loader2, ExternalLink, Undo2, Pencil,
  Wallet, Banknote, TrendingUp, TrendingDown, BarChart3, Salad, Lock, Mail,
  ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { FaInstagram } from 'react-icons/fa'

type Stats = Record<string, { total: number; paid: number; tickets: number; refunded: number }>

// ISO string -> value for <input type="datetime-local"> in local time
function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string) {
  return v ? new Date(v).toISOString() : ''
}

export default function EventsAdmin({
  events, tickets, regStats, registrationsByEvent,
}: {
  events: EventRow[]; tickets: EventTicket[]; regStats: Stats
  registrationsByEvent: Record<string, EventRegistration[]>
}) {
  const searchParams = useSearchParams()
  const linkedEventId = searchParams.get('event')

  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [attendeesOpenId, setAttendeesOpenId] = useState<string | null>(null)
  const [dataOpenId, setDataOpenId] = useState<string | null>(linkedEventId)
  const [showPast, setShowPast] = useState(() => !!linkedEventId && events.some(ev => ev.id === linkedEventId && isPastEvent(ev)))
  const linkedRef = useRef<HTMLDivElement>(null)

  // Deep-linked from the dashboard's "Tickets sold per event" - scroll the
  // matching card into view once the page has rendered its Event Data panel open.
  useEffect(() => {
    if (linkedEventId && linkedRef.current) {
      linkedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ticketsByEvent: Record<string, EventTicket[]> = {}
  tickets.forEach(t => {
    ;(ticketsByEvent[t.event_id] ||= []).push(t)
  })

  const upcoming = events.filter(ev => !isPastEvent(ev))
  const past = events.filter(ev => isPastEvent(ev))

  function cardProps(ev: EventRow) {
    return {
      ev,
      expanded: expandedId === ev.id,
      onToggleExpand: () => { setExpandedId(expandedId === ev.id ? null : ev.id); setCreating(false) },
      attendeesOpen: attendeesOpenId === ev.id,
      onToggleAttendees: () => setAttendeesOpenId(attendeesOpenId === ev.id ? null : ev.id),
      dataOpen: dataOpenId === ev.id,
      onToggleData: () => setDataOpenId(dataOpenId === ev.id ? null : ev.id),
      stats: regStats[ev.id] || { total: 0, paid: 0, tickets: 0, refunded: 0 },
      tickets: ticketsByEvent[ev.id] || [],
      registrations: registrationsByEvent[ev.id] || [],
      scrollRef: ev.id === linkedEventId ? linkedRef : undefined,
    }
  }

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Events &amp; Ticketing" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-white">Events</h2>
          <button
            onClick={() => { setCreating(true); setExpandedId(null) }}
            className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> New event
          </button>
        </div>

        {creating && (
          <div className="bg-charcoal-800 border border-gold-500/40 rounded-2xl mb-6">
            <div className="px-6 py-4 border-b border-charcoal-700">
              <h3 className="font-display font-bold text-white">Create a new event</h3>
            </div>
            <EventForm onClose={() => setCreating(false)} />
          </div>
        )}

        {events.length === 0 && !creating ? (
          <div className="text-center py-20 text-gray-500">
            <Calendar size={40} className="mx-auto mb-4 opacity-40" />
            <p>No events yet. Create your first one.</p>
          </div>
        ) : (
          <>
            {upcoming.length === 0 ? (
              <p className="text-gray-500 text-sm py-6 text-center">No upcoming events.</p>
            ) : (
              <div className="space-y-4">
                {upcoming.map(ev => <EventListCard key={ev.id} {...cardProps(ev)} />)}
              </div>
            )}

            {past.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowPast(v => !v)}
                  className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-semibold"
                >
                  {showPast ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  {showPast ? 'Hide past events' : `See past events (${past.length})`}
                </button>

                {showPast && (
                  <div className="mt-4">
                    <h3 className="font-display text-lg font-bold text-white mb-4">Past Events</h3>
                    <div className="space-y-4">
                      {past.map(ev => <EventListCard key={ev.id} {...cardProps(ev)} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EventListCard({
  ev, expanded, onToggleExpand, attendeesOpen, onToggleAttendees, dataOpen, onToggleData, stats, tickets, registrations, scrollRef,
}: {
  ev: EventRow
  expanded: boolean
  onToggleExpand: () => void
  attendeesOpen: boolean
  onToggleAttendees: () => void
  dataOpen: boolean
  onToggleData: () => void
  stats: { total: number; paid: number; tickets: number; refunded: number }
  tickets: EventTicket[]
  registrations: EventRegistration[]
  scrollRef?: React.RefObject<HTMLDivElement>
}) {
  const past = isPastEvent(ev)
  const [confirmingManage, setConfirmingManage] = useState(false)
  const [managePassword, setManagePassword] = useState('')
  const [manageBusy, setManageBusy] = useState(false)
  const [manageError, setManageError] = useState('')

  function handleManageClick() {
    if (expanded) { onToggleExpand(); return } // closing doesn't need re-confirmation
    setManagePassword(''); setManageError(''); setConfirmingManage(true)
  }

  async function confirmManage() {
    setManageError('')
    if (!managePassword) return setManageError('Please enter the admin password.')
    setManageBusy(true)
    const res = await fetch('/api/admin/verify-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: managePassword }),
    })
    if (res.ok) {
      setConfirmingManage(false)
      onToggleExpand()
    } else {
      setManageError('Incorrect password.')
    }
    setManageBusy(false)
  }

  return (
    <div ref={scrollRef} className="bg-charcoal-800 rounded-2xl border border-charcoal-700 overflow-hidden">
      <div className="flex items-start justify-between p-5 gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {ev.flyer_url && ev.flyer_url.startsWith('http') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ev.flyer_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-charcoal-600 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-display text-lg font-bold text-white truncate">{ev.title}</h3>
              <StatusBadge status={ev.status} past={past} />
            </div>
            <p className="text-gray-400 text-sm flex items-center gap-1.5">
              <Calendar size={13} /> {new Date(ev.event_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })}
            </p>
            {(ev.venue || ev.location) && (
              <p className="text-gray-500 text-sm flex items-center gap-1.5 mt-0.5">
                <MapPin size={13} /> {[ev.venue, ev.location].filter(Boolean).join(', ')}
              </p>
            )}
            <p className="text-gray-500 text-xs mt-1.5 flex items-center gap-1.5">
              <Users size={12} /> {stats.tickets}{ev.capacity_limit != null ? ` / ${ev.capacity_limit}` : ''} tickets · {stats.paid} paid {stats.paid === 1 ? 'booking' : 'bookings'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          <a href={`/events/${ev.slug}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white p-2" title="View public page">
            <ExternalLink size={16} />
          </a>
          <div className="flex flex-col gap-2">
            <button
              onClick={onToggleData}
              className="inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {dataOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Event Data
            </button>
            <button
              onClick={onToggleAttendees}
              className="inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {attendeesOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Attendees
            </button>
            <button
              onClick={handleManageClick}
              className="inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {expanded ? <ChevronUp size={15} /> : <Lock size={15} />} Manage
            </button>
          </div>
        </div>
      </div>

      {confirmingManage && (
        <div className="border-t border-charcoal-700 p-4">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <p className="text-red-300 text-sm font-semibold flex items-center gap-1.5"><Lock size={14} /> Edit event details?</p>
            <p className="text-red-200/80 text-xs mt-1 mb-3">
              This enables event details to be changed. Enter the admin password to confirm.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                type="password"
                value={managePassword}
                onChange={e => setManagePassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmManage() }}
                placeholder="Admin password"
                autoFocus
                className="flex-1 max-w-xs px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-2">
                <button onClick={confirmManage} disabled={manageBusy}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  {manageBusy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} {manageBusy ? 'Checking...' : 'Yes, continue'}
                </button>
                <button onClick={() => setConfirmingManage(false)} disabled={manageBusy}
                  className="bg-charcoal-700 hover:bg-charcoal-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
            {manageError && <p className="text-red-300 text-sm mt-2">{manageError}</p>}
          </div>
        </div>
      )}

      {dataOpen && (
        <div className="border-t border-charcoal-700">
          <EventDataPanel eventId={ev.id} tickets={tickets} registrations={registrations} />
        </div>
      )}

      {attendeesOpen && (
        <div className="border-t border-charcoal-700">
          <ReadOnlyAttendeesList eventId={ev.id} registrations={registrations} />
        </div>
      )}

      {expanded && (
        <div className="border-t border-charcoal-700">
          <Section title="Event details">
            <EventForm event={ev} onClose={onToggleExpand} />
          </Section>
          <Section title="Tickets">
            <TicketManager eventId={ev.id} tickets={tickets} />
          </Section>
          <Section title="Attendees / door list">
            <AttendeesPanel eventId={ev.id} stats={stats} registrations={registrations} tickets={tickets} />
          </Section>
          <Section title="Waitlist">
            <WaitlistPanel eventId={ev.id} />
          </Section>
          <Section title="Additional revenue &amp; costs">
            <ExtraFinancesPanel eventId={ev.id} />
          </Section>
          <Section title="Photos &amp; videos">
            <GalleryManager event={ev} />
          </Section>
          <div className="px-6 py-4">
            <DeleteEvent id={ev.id} title={ev.title} />
          </div>
        </div>
      )}
    </div>
  )
}

// Read-only attendee list for the "Attendees" button - same information as
// the Manage panel's attendee rows, but with no Refund/Delete actions.
type FlatAttendee = {
  key: string
  name: string
  ticketName: string
  status: EventRegistration['status']
  isGuest: boolean
  buyerName?: string
  email?: string
  amountAed: number
  age?: number | null
}

// One row per actual person - the lead buyer plus each named guest - so the
// count reflects real attendee headcount, not just the number of bookings.
function flattenAttendees(registrations: EventRegistration[]): FlatAttendee[] {
  const sorted = [...registrations].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const rows: FlatAttendee[] = []
  sorted.forEach(reg => {
    const buyerName = `${reg.first_name} ${reg.last_name}`.trim()
    rows.push({
      key: reg.id, name: buyerName, ticketName: reg.ticket_name || 'Ticket',
      status: reg.status, isGuest: false, email: reg.email, amountAed: reg.amount_aed,
      age: reg.attendee_age ?? null,
    })
    ;(reg.guest_names || []).forEach((g, i) => {
      const name = typeof g === 'string' ? g : (g?.name || '')
      if (!name) return
      const ticketName = typeof g === 'string' ? reg.ticket_name : (g.ticket_name || reg.ticket_name)
      rows.push({
        key: `${reg.id}-g${i}`, name, ticketName: ticketName || 'Ticket',
        status: reg.status, isGuest: true, buyerName, amountAed: typeof g === 'string' ? 0 : (g.price_aed || 0),
        age: typeof g === 'string' ? null : (g.age ?? null),
      })
    })
  })
  return rows
}

function ReadOnlyAttendeesList({ eventId, registrations }: { eventId: string; registrations: EventRegistration[] }) {
  const [showAll, setShowAll] = useState(false)
  // Only people who actually paid are coming. Someone who starts checkout and
  // abandons it leaves a 'pending' row behind, and starting again creates
  // another row - so counting every row would inflate the headcount with
  // people who never bought a ticket. This matches the door list export.
  const paidRegs = registrations.filter(r => r.status === 'paid')
  const unpaidCount = registrations.length - paidRegs.length
  const attendees = flattenAttendees(paidRegs)
  const numbered = attendees.map((a, i) => ({ a, n: i + 1 }))
  const visible = showAll ? numbered : numbered.slice(0, 8)

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="text-gray-500 text-xs uppercase tracking-wide">
          {paidRegs.length} paid {paidRegs.length === 1 ? 'booking' : 'bookings'} · {attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'}
          {unpaidCount > 0 && (
            <span className="text-gray-600 normal-case tracking-normal">
              {' '}({unpaidCount} unpaid {unpaidCount === 1 ? 'attempt' : 'attempts'} not counted)
            </span>
          )}
        </p>
        <a href={`/api/admin/events/export?eventId=${eventId}`}
          className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
          <Download size={14} /> Download door list (Excel)
        </a>
      </div>
      {attendees.length === 0 ? (
        <p className="text-gray-500 text-sm">No paid bookings yet.</p>
      ) : (
        <>
          <div className="space-y-3">
            {visible.map(({ a, n }) => (
              <div key={a.key} className="flex items-center gap-4 bg-charcoal-700/50 rounded-xl px-6 py-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-charcoal-600 text-gray-300 text-xs font-semibold flex items-center justify-center">{n}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-semibold truncate">{a.name}</p>
                  <p className="text-gray-400 text-sm truncate">
                    {a.isGuest ? `Guest of ${a.buyerName}` : a.email} · {a.ticketName}{a.age != null ? ` · age ${a.age}` : ''} · {a.amountAed > 0 ? `${a.amountAed} AED` : 'Free'}
                  </p>
                </div>
                <RegStatusBadge status={a.status} />
              </div>
            ))}
          </div>
          {attendees.length > 8 && (
            <button onClick={() => setShowAll(v => !v)} className="text-gold-400 hover:underline text-xs font-medium mt-3">
              {showAll ? 'Show fewer' : `Show all ${attendees.length} attendees`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// Read-only infographic-style stats for the "Event Data" button: tickets
// sold (overall and per type), dietary requirement counts, and the
// cost/revenue/profit picture. Internal only - cost figures never leave
// this admin page.
function EventDataPanel({ eventId, tickets, registrations }: { eventId: string; tickets: EventTicket[]; registrations: EventRegistration[] }) {
  const ticketsByName = new Map(tickets.map(t => [t.name, t]))
  const paid = registrations.filter(r => r.status === 'paid')

  // Anything recorded under "Additional revenue & costs" - venue hire,
  // sponsorship, the DJ.
  //
  // This panel used to total only the cost prices set against each ticket type,
  // and ignored operating_costs entirely. An event with a 444 AED venue hire and
  // no per-ticket cost therefore reported 0 AED cost and its whole ticket income
  // as profit. The figure looked precise and was wrong, which is worse than
  // showing nothing.
  const [extra, setExtra] = useState<{ revenue: number; costs: number } | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/admin/events/finances?eventId=${eventId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!live || !d) return
        setExtra({
          revenue: (d.revenue || []).reduce((s: number, r: ExtraRevenueLine) => s + (Number(r.amountAed) || 0), 0),
          costs: (d.costs || []).reduce((s: number, c: ExtraCostLine) => s + (Number(c.amountAed) || 0), 0),
        })
      })
      .catch(() => {})
    return () => { live = false }
  }, [eventId])

  type Unit = { ticketName: string; cost: number; price: number }
  const units: Unit[] = []
  paid.forEach(r => {
    const buyerTicket = ticketsByName.get(r.ticket_name || '')
    units.push({
      ticketName: r.ticket_name || 'Ticket',
      cost: buyerTicket?.cost_price_aed ?? 0,
      price: buyerTicket?.price_aed ?? 0,
    })
    ;(r.guest_names || []).forEach(g => {
      const t = ticketsByName.get(g.ticket_name || '')
      units.push({
        ticketName: g.ticket_name || r.ticket_name || 'Ticket',
        cost: t?.cost_price_aed ?? 0,
        price: t?.price_aed ?? (g.price_aed || 0),
      })
    })
  })

  const totalTickets = units.length
  const ticketCost = units.reduce((s, u) => s + u.cost, 0)
  const ticketRevenue = units.reduce((s, u) => s + u.price, 0)
  // Until the extra lines have loaded these read as ticket-only, which is what
  // the panel showed before - never a number that is briefly too optimistic.
  const totalCost = ticketCost + (extra?.costs || 0)
  const totalRevenue = ticketRevenue + (extra?.revenue || 0)
  const totalProfit = totalRevenue - totalCost

  const perType = new Map<string, number>()
  units.forEach(u => perType.set(u.ticketName, (perType.get(u.ticketName) || 0) + 1))
  const perTypeArr = Array.from(perType.entries()).sort((a, b) => b[1] - a[1])
  const maxTypeCount = Math.max(1, ...perTypeArr.map(([, c]) => c))

  const dietaryCounts = { vegetarian: 0, vegan: 0, other: 0 }
  paid.forEach(r => {
    const tally = (d?: string | null) => { if (d === 'vegetarian' || d === 'vegan' || d === 'other') dietaryCounts[d] += 1 }
    tally(r.dietary)
    ;(r.guest_names || []).forEach(g => tally(g.dietary))
  })
  const dietaryTotal = dietaryCounts.vegetarian + dietaryCounts.vegan + dietaryCounts.other

  return (
    <div className="px-6 py-6">
      <div className="flex justify-end mb-2">
        <a href={`/api/admin/events/export?eventId=${eventId}`}
          className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
          <Download size={14} /> Download door list (Excel)
        </a>
      </div>
      <div className="text-center mb-6">
        <p className="text-5xl font-display font-bold text-white">{totalTickets}</p>
        <p className="text-gray-400 text-xs uppercase tracking-widest mt-1">Tickets sold</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Wallet} label="Total cost" value={`${totalCost} AED`} tone="gray" />
        <StatCard icon={Banknote} label="Total revenue" value={`${totalRevenue} AED`} tone="gold" />
        <StatCard
          icon={totalProfit >= 0 ? TrendingUp : TrendingDown}
          label="Total profit"
          value={`${totalProfit} AED`}
          tone={totalProfit >= 0 ? 'green' : 'red'}
        />
      </div>

      {extra && (extra.costs > 0 || extra.revenue > 0) && (
        <p className="text-gray-500 text-xs -mt-6 mb-8 text-center">
          Includes {extra.costs > 0 ? `${extra.costs} AED of additional costs` : ''}
          {extra.costs > 0 && extra.revenue > 0 ? ' and ' : ''}
          {extra.revenue > 0 ? `${extra.revenue} AED of additional revenue` : ''}
          {' '}from the Additional revenue &amp; costs section below.
        </p>
      )}

      {totalTickets === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No paid bookings yet.</p>
      ) : (
        <>
          <div className="mb-8">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-3 flex items-center gap-1.5">
              <BarChart3 size={14} /> Tickets sold per type
            </p>
            <div className="space-y-2.5">
              {perTypeArr.map(([name, count]) => (
                <div key={name} className="flex items-center gap-3">
                  <p className="text-gray-300 text-sm w-40 truncate shrink-0" title={name}>{name}</p>
                  <div className="flex-1 h-5 rounded-full bg-charcoal-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300"
                      style={{ width: `${Math.max(4, (count / maxTypeCount) * 100)}%` }}
                    />
                  </div>
                  <p className="text-gold-400 text-sm font-semibold w-8 text-right shrink-0">{count}</p>
                </div>
              ))}
            </div>
          </div>

          {dietaryTotal > 0 && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-3 flex items-center gap-1.5">
                <Salad size={14} /> Dietary requirements
              </p>
              <div className="flex flex-wrap gap-3">
                <DietChip label="Vegetarian" count={dietaryCounts.vegetarian} />
                <DietChip label="Vegan" count={dietaryCounts.vegan} />
                <DietChip label="Other" count={dietaryCounts.other} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const STAT_TONES = {
  gray: { bg: 'bg-charcoal-700/60', icon: 'text-gray-300' },
  gold: { bg: 'bg-gold-500/10', icon: 'text-gold-400' },
  green: { bg: 'bg-green-500/10', icon: 'text-green-400' },
  red: { bg: 'bg-red-500/10', icon: 'text-red-400' },
}

function StatCard({ icon: Icon, label, value, tone }: {
  icon: React.ElementType; label: string; value: string; tone: keyof typeof STAT_TONES
}) {
  const t = STAT_TONES[tone]
  return (
    <div className={`rounded-xl ${t.bg} p-4 flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-lg bg-charcoal-800 flex items-center justify-center shrink-0 ${t.icon}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-white font-display text-lg font-bold truncate">{value}</p>
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      </div>
    </div>
  )
}

function DietChip({ label, count }: { label: string; count: number }) {
  if (count === 0) return null
  return (
    <div className="inline-flex items-center gap-2 bg-charcoal-700/60 rounded-full px-4 py-2">
      <span className="text-white font-display font-bold">{count}</span>
      <span className="text-gray-400 text-sm">{label}</span>
    </div>
  )
}

// Waitlist for one event.
//
// Places are never offered automatically. A freed seat goes to whoever books
// first, and auto-emailing the whole queue the moment somebody cancels would
// send several people to a page where only one of them can succeed. The admin
// sees how many seats are actually free and chooses who to offer them to.
type WaitEntry = {
  id: string
  created_at: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  tickets_wanted: number
  status: 'waiting' | 'invited' | 'converted' | 'declined' | 'removed'
  invited_at: string | null
}

const WAIT_TONE: Record<string, string> = {
  waiting: 'bg-charcoal-700 text-gray-300',
  invited: 'bg-gold-500/20 text-gold-400',
  converted: 'bg-green-500/15 text-green-400',
  declined: 'bg-charcoal-700 text-gray-500',
  removed: 'bg-charcoal-700 text-gray-600',
}

function WaitlistPanel({ eventId }: { eventId: string }) {
  const [entries, setEntries] = useState<WaitEntry[]>([])
  const [seatsFree, setSeatsFree] = useState<number | null>(null)
  const [capacityLimit, setCapacityLimit] = useState<number | null>(null)
  const [waitlistOpen, setWaitlistOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)

  const load = async () => {
    const res = await fetch(`/api/admin/events/waitlist?eventId=${eventId}`)
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      setEntries(d.entries || [])
      setSeatsFree(d.seatsFree)
      setCapacityLimit(d.capacityLimit)
      setWaitlistOpen(d.waitlistOpen !== false)
    } else {
      setError(d.error || 'Could not load the waitlist.')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(id); setError('')
    const res = await fetch('/api/admin/events/waitlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) return setError(d.error || 'That did not work.')
    load()
  }

  async function toggleOpen() {
    setBusy('toggle')
    await fetch('/api/admin/events/waitlist', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, open: !waitlistOpen }),
    })
    setBusy(null); load()
  }

  async function remove(e: WaitEntry) {
    if (!confirm(`Remove ${e.first_name} ${e.last_name} from the waitlist?`)) return
    setBusy(e.id)
    await fetch(`/api/admin/events/waitlist?id=${e.id}`, { method: 'DELETE' })
    setBusy(null); load()
  }

  if (loading) {
    return <div className="px-6 py-5 text-gray-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</div>
  }

  if (capacityLimit == null) {
    return (
      <div className="px-6 py-5">
        <p className="text-gray-400 text-sm">
          This event has no ticket limit, so it cannot sell out and there is nothing to wait for. Set a limit in
          Event details to enable the waitlist.
        </p>
      </div>
    )
  }

  const waiting = entries.filter(e => e.status === 'waiting')
  const invited = entries.filter(e => e.status === 'invited')
  const visible = showAll ? entries : entries.filter(e => e.status === 'waiting' || e.status === 'invited')

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-center gap-6 mb-5">
        <div><p className="text-2xl font-display font-bold text-gold-400">{waiting.length}</p><p className="text-gray-400 text-xs">Waiting</p></div>
        {invited.length > 0 && (
          <div><p className="text-2xl font-display font-bold text-gold-300">{invited.length}</p><p className="text-gray-400 text-xs">Offered a place</p></div>
        )}
        <div>
          <p className={`text-2xl font-display font-bold ${seatsFree ? 'text-green-400' : 'text-white'}`}>{seatsFree ?? '-'}</p>
          <p className="text-gray-400 text-xs">Seats free now</p>
        </div>
        <button
          onClick={toggleOpen}
          disabled={busy === 'toggle'}
          className="ml-auto inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          {busy === 'toggle' ? <Loader2 size={14} className="animate-spin" /> : null}
          {waitlistOpen ? 'Close the waitlist' : 'Open the waitlist'}
        </button>
      </div>

      {!waitlistOpen && (
        <p className="text-amber-400/90 text-xs mb-4">
          The waitlist is closed. The event page tells people it is sold out but does not offer the form. Anyone
          already on the list stays on it.
        </p>
      )}

      {seatsFree === 0 && waiting.length > 0 && (
        <p className="text-gray-500 text-xs mb-4 leading-relaxed">
          No seats are free, so nobody can be offered a place yet. A seat frees up when you refund or cancel a
          booking, or raise the ticket limit in Event details.
        </p>
      )}

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">Nobody on the waitlist yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {visible.map((e, i) => (
              <div key={e.id} className="flex items-start justify-between gap-3 bg-charcoal-700/40 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-600 text-xs font-mono w-5">{i + 1}</span>
                    <p className="text-white text-sm font-medium truncate">{e.first_name} {e.last_name}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${WAIT_TONE[e.status]}`}>
                      {e.status === 'invited' ? 'Offered' : e.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs truncate mt-0.5 pl-7">
                    {e.email}{e.phone ? ` · ${e.phone}` : ''} · wants {e.tickets_wanted} ticket{e.tickets_wanted === 1 ? '' : 's'}
                    {' · joined '}{new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {e.invited_at && ` · offered ${new Date(e.invited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(e.status === 'waiting' || e.status === 'invited') && (
                    <button
                      onClick={() => act(e.id, { action: 'offer' })}
                      disabled={busy === e.id || seatsFree === 0}
                      title={seatsFree === 0 ? 'No seats are free to offer' : 'Email them a link to book'}
                      className="inline-flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      {busy === e.id ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                      {e.status === 'invited' ? 'Offer again' : 'Offer a place'}
                    </button>
                  )}
                  {e.status === 'invited' && (
                    <button
                      onClick={() => act(e.id, { status: 'converted' })}
                      className="bg-charcoal-700 hover:bg-green-500/20 hover:text-green-400 text-gray-300 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      title="They booked"
                    >
                      Booked
                    </button>
                  )}
                  <button
                    onClick={() => remove(e)}
                    className="text-gray-600 hover:text-red-400 p-1.5"
                    title="Remove from the waitlist"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {entries.length !== visible.length && (
            <button onClick={() => setShowAll(true)} className="text-gold-400 hover:underline text-xs font-medium mt-3">
              Show all {entries.length}, including removed and declined
            </button>
          )}
        </>
      )}

      <p className="text-gray-600 text-xs mt-4 leading-relaxed">
        Offering a place emails a link to book. It does not reserve anything: whoever books first gets the seat, and
        the email says so. Offer more than one person if you want to fill a seat quickly.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Additional revenue & costs for one event                            */
/* ------------------------------------------------------------------ */

type ExtraRevenueLine = { id: string; date: string; kind: string; description: string; amountAed: number }
type ExtraCostLine = { id: string; date: string; category: string; description: string; amountAed: number }

const aed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Sponsorship money in, DJ and lighting out. Loaded on demand rather than
// with the events list, because most events have none and the Manage panel
// is already a heavy screen.
function ExtraFinancesPanel({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [revenue, setRevenue] = useState<ExtraRevenueLine[]>([])
  const [costs, setCosts] = useState<ExtraCostLine[]>([])
  const [adding, setAdding] = useState<'revenue' | 'cost' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const blank = { date: today, kind: 'sponsorship', category: 'DJ & music', description: '', amountAed: '' }
  const [form, setForm] = useState(blank)

  async function load() {
    const res = await fetch(`/api/admin/events/finances?eventId=${eventId}`)
    const d = await res.json()
    if (res.ok) {
      setEnabled(!!d.enabled)
      setRevenue(d.revenue || [])
      setCosts(d.costs || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setAnswer(next: boolean) {
    setEnabled(next)
    await fetch('/api/admin/events/finances', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, enabled: next }),
    })
  }

  async function addLine() {
    setError('')
    if (!form.description.trim()) return setError('Please describe the line item.')
    const amount = parseFloat(form.amountAed)
    if (!Number.isFinite(amount) || amount <= 0) return setError('Please enter an amount greater than zero.')
    setBusy(true)
    const res = await fetch('/api/admin/events/finances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId, type: adding, date: form.date, description: form.description.trim(),
        amountAed: amount, kind: form.kind, category: form.category,
      }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) return setError(d.error || 'Could not save.')
    setForm(blank)
    setAdding(null)
    load()
  }

  async function removeLine(id: string, type: 'revenue' | 'cost') {
    if (!confirm('Delete this line?')) return
    setDeleting(id)
    await fetch(`/api/admin/events/finances?id=${id}&type=${type}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  const totalRevenue = revenue.reduce((s, r) => s + r.amountAed, 0)
  const totalCosts = costs.reduce((s, c) => s + c.amountAed, 0)
  const net = totalRevenue - totalCosts

  const input = 'w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500'

  if (loading) {
    return (
      <div className="px-6 py-5 text-gray-500 text-sm flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading...
      </div>
    )
  }

  return (
    <div className="px-6 py-5">
      <p className="text-gray-300 text-sm mb-3">Are there additional costs or revenue you wish to record?</p>
      <div className="flex items-center gap-2 mb-1">
        {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(o => (
          <button
            key={o.l}
            onClick={() => setAnswer(o.v)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              enabled === o.v ? 'bg-gold-500 text-white' : 'bg-charcoal-700 text-gray-400 hover:text-white'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
      <p className="text-gray-600 text-xs mb-1">
        Sponsorship, bar takings, DJ, lighting and anything else not already covered by ticket prices and their cost
        prices. Everything you enter here appears in the Money section.
      </p>

      {enabled === false && (revenue.length > 0 || costs.length > 0) && (
        <p className="text-amber-400/80 text-xs mt-3">
          {revenue.length + costs.length} line{revenue.length + costs.length === 1 ? '' : 's'} already recorded for
          this event. They still count in the Money section. Choose Yes to see or remove them.
        </p>
      )}

      {enabled && (
        <div className="mt-5 space-y-5">

          <LineGroup
            title="Additional revenue"
            tone="green"
            rows={revenue.map(r => ({
              id: r.id,
              date: r.date,
              tag: EVENT_REVENUE_KINDS.find(k => k.value === r.kind)?.label ?? r.kind,
              description: r.description,
              amountAed: r.amountAed,
            }))}
            total={totalRevenue}
            onDelete={id => removeLine(id, 'revenue')}
            deleting={deleting}
            onAdd={() => { setForm({ ...blank, kind: 'sponsorship' }); setError(''); setAdding('revenue') }}
            addLabel="Add revenue line"
            emptyLabel="No additional revenue recorded."
          />

          <LineGroup
            title="Additional costs"
            tone="red"
            rows={costs.map(c => ({
              id: c.id, date: c.date, tag: c.category, description: c.description, amountAed: c.amountAed,
            }))}
            total={totalCosts}
            onDelete={id => removeLine(id, 'cost')}
            deleting={deleting}
            onAdd={() => { setForm({ ...blank, category: 'DJ & music' }); setError(''); setAdding('cost') }}
            addLabel="Add cost line"
            emptyLabel="No additional costs recorded."
          />

          {adding && (
            <div className="bg-charcoal-900 border border-charcoal-600 rounded-xl p-4">
              <p className="text-white text-sm font-semibold mb-3">
                {adding === 'revenue' ? 'New revenue line' : 'New cost line'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <label className="block">
                  <span className="text-gray-400 text-xs block mb-1">Date</span>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={input} />
                </label>
                <label className="block">
                  <span className="text-gray-400 text-xs block mb-1">{adding === 'revenue' ? 'Type' : 'Category'}</span>
                  {adding === 'revenue' ? (
                    <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={input}>
                      {EVENT_REVENUE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                  ) : (
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={input}>
                      {EVENT_COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </label>
                <label className="block">
                  <span className="text-gray-400 text-xs block mb-1">Amount (AED)</span>
                  <input
                    type="number" min="0" step="0.01" value={form.amountAed}
                    onChange={e => setForm({ ...form, amountAed: e.target.value })}
                    placeholder="0.00" className={input}
                  />
                </label>
              </div>
              <label className="block mb-3">
                <span className="text-gray-400 text-xs block mb-1">Description</span>
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder={adding === 'revenue' ? 'e.g. Sponsorship from Acme Ltd' : 'e.g. DJ Ravi, 4 hours'}
                  className={input}
                />
              </label>
              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={addLine} disabled={busy}
                  className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save line
                </button>
                <button
                  onClick={() => { setAdding(null); setError('') }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(revenue.length > 0 || costs.length > 0) && (
            <div className="flex items-baseline justify-between gap-3 pt-4 border-t border-charcoal-700">
              <span className="text-gray-400 text-sm font-medium">Net effect on this event</span>
              <span className={`font-display text-xl font-bold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {net < 0 ? '-' : ''}{aed(Math.abs(net))} AED
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LineGroup({
  title, tone, rows, total, onDelete, deleting, onAdd, addLabel, emptyLabel,
}: {
  title: string
  tone: 'green' | 'red'
  rows: { id: string; date: string; tag: string; description: string; amountAed: number }[]
  total: number
  onDelete: (id: string) => void
  deleting: string | null
  onAdd: () => void
  addLabel: string
  emptyLabel: string
}) {
  const colour = tone === 'green' ? 'text-green-400' : 'text-red-400'
  const Icon = tone === 'green' ? TrendingUp : TrendingDown
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className={`text-sm font-semibold inline-flex items-center gap-1.5 ${colour}`}>
          <Icon size={15} /> {title}
        </p>
        <button onClick={onAdd} className="text-gray-400 hover:text-white text-xs font-semibold inline-flex items-center gap-1">
          <Plus size={13} /> {addLabel}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-600 text-sm py-2">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[460px]">
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-charcoal-700">
                  <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap w-20">
                    {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-400 whitespace-nowrap">{r.tag}</td>
                  <td className="py-2.5 pr-4 text-white">{r.description}</td>
                  <td className={`py-2.5 text-right font-medium whitespace-nowrap ${colour}`}>{aed(r.amountAed)}</td>
                  <td className="py-2.5 pl-3 text-right w-8">
                    <button
                      onClick={() => onDelete(r.id)}
                      disabled={deleting === r.id}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="Delete line"
                    >
                      {deleting === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-charcoal-600">
                <td colSpan={3} className="py-2.5 text-gray-500">Subtotal</td>
                <td className={`py-2.5 text-right font-semibold ${colour}`}>{aed(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-charcoal-700 last:border-b-0">
      <div className="px-6 pt-5 pb-1">
        <h4 className="text-gold-400 text-xs font-semibold uppercase tracking-wide">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function StatusBadge({ status, past }: { status: string; past: boolean }) {
  if (past) return <span className="bg-charcoal-700 text-gray-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">Past</span>
  if (status === 'published') return <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">Published</span>
  return <span className="bg-red-500/20 text-red-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">Draft</span>
}

// ---------------------------------------------------------------------------
// Event create / edit form
// ---------------------------------------------------------------------------
function EventForm({ event, onClose }: { event?: EventRow; onClose: () => void }) {
  const router = useRouter()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    venue: event?.venue || '',
    location: event?.location || '',
    google_maps_url: event?.google_maps_url || '',
    event_date: toLocalInput(event?.event_date),
    end_date: toLocalInput(event?.end_date),
    tags: (event?.tags || []).join(', '),
    status: event?.status || 'draft',
    flyer_url: event?.flyer_url || '',
  })
  const [limitTickets, setLimitTickets] = useState(event?.capacity_limit != null)
  const [capacityLimit, setCapacityLimit] = useState(event?.capacity_limit != null ? String(event.capacity_limit) : '')
  const [dietaryRequired, setDietaryRequired] = useState(event?.dietary_required ?? false)
  const [flyerFile, setFlyerFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function save() {
    setError('')
    if (!form.title.trim()) return setError('Please enter a title.')
    if (!form.event_date) return setError('Please choose a date and time.')
    if (limitTickets && !capacityLimit.trim()) return setError('Please enter a ticket limit, or untick the box.')
    setSaving(true)
    try {
      let flyerUrl = form.flyer_url
      if (flyerFile) {
        const flyer = await compressImage(flyerFile)
        try {
          const up = await uploadViaSignedUrl({ kind: 'event-flyer', file: flyer })
          flyerUrl = up.publicUrl || flyerUrl
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Flyer upload failed. Try a different image or paste a URL.')
          setSaving(false)
          return
        }
      }
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: event?.id,
          title: form.title,
          description: form.description,
          venue: form.venue,
          location: form.location,
          google_maps_url: form.google_maps_url,
          event_date: fromLocalInput(form.event_date),
          end_date: form.end_date ? fromLocalInput(form.end_date) : null,
          tags: form.tags,
          status: form.status,
          flyer_url: flyerUrl,
          capacity_limit: limitTickets ? capacityLimit : null,
          dietary_required: dietaryRequired,
        }),
      })
      if (res.ok) {
        router.refresh()
        setSaving(false)
        if (!event) {
          // New event created - close the create form; it now appears in the list.
          onClose()
        } else {
          // Existing event edited - stay open and confirm.
          setSaved(true)
          setTimeout(() => setSaved(false), 2500)
        }
      }
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not save.'); setSaving(false) }
    } catch { setError('Something went wrong.'); setSaving(false) }
  }

  return (
    <div className="px-6 py-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FField label="Title" className="md:col-span-2"><Inp value={form.title} onChange={v => set('title', v)} placeholder="Diwali Gala 2026" /></FField>
        <FField label="Date & time"><Inp type="datetime-local" value={form.event_date} onChange={v => set('event_date', v)} /></FField>
        <FField label="End (optional)"><Inp type="datetime-local" value={form.end_date} onChange={v => set('end_date', v)} /></FField>
        <FField label="Venue"><Inp value={form.venue} onChange={v => set('venue', v)} placeholder="Atlantis The Palm" /></FField>
        <FField label="Area / city"><Inp value={form.location} onChange={v => set('location', v)} placeholder="Dubai" /></FField>
        <FField label="Google Maps link (optional)" className="md:col-span-2">
          <Inp value={form.google_maps_url} onChange={v => set('google_maps_url', v)} placeholder="https://maps.app.goo.gl/..." />
        </FField>
        <FField label="Tags (comma separated)" className="md:col-span-2"><Inp value={form.tags} onChange={v => set('tags', v)} placeholder="diwali, family, cultural" /></FField>
        <FField label="Description" className="md:col-span-2">
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4}
            className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none" />
        </FField>
        <FField label="Limit tickets available?" className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-200 mb-2">
            <input
              type="checkbox"
              checked={limitTickets}
              onChange={e => setLimitTickets(e.target.checked)}
              className="h-4 w-4 accent-gold-500"
            />
            Cap the total number of tickets sold for this event
          </label>
          {limitTickets && (
            <div className="max-w-[180px]">
              <Inp type="number" value={capacityLimit} onChange={setCapacityLimit} placeholder="e.g. 100" />
            </div>
          )}
        </FField>
        <FField label="Dietary requirements?" className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={dietaryRequired}
              onChange={e => setDietaryRequired(e.target.checked)}
              className="h-4 w-4 accent-gold-500"
            />
            Ask each attendee for dietary requirements when booking (Vegetarian / Vegan / Other)
          </label>
        </FField>
        <FField label="Flyer image" className="md:col-span-2">
          <input type="file" accept="image/*" onChange={e => setFlyerFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gold-500 file:text-white file:text-sm file:font-semibold hover:file:bg-gold-600" />
          {form.flyer_url && !flyerFile && (
            <div className="flex items-center gap-2 mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.flyer_url} alt="" className="h-14 rounded-lg border border-charcoal-600" />
              <span className="text-gray-500 text-xs">Current flyer</span>
            </div>
          )}
        </FField>
        <FField label="Status" className="md:col-span-2">
          <select value={form.status} onChange={e => set('status', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gold-500 ${
              form.status === 'published' ? 'bg-green-600 border-green-500' : 'bg-red-600 border-red-500'
            }`}>
            <option value="draft" className="bg-charcoal-800 text-white font-normal">Draft - hidden from the public site</option>
            <option value="published" className="bg-charcoal-800 text-white font-normal">Published - live on the events page</option>
          </select>
        </FField>
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save event'}
        </button>
        <button onClick={onClose} disabled={saving}
          className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-gray-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
          <X size={16} /> Close
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ticket manager
// ---------------------------------------------------------------------------
function TicketManager({ eventId, tickets }: { eventId: string; tickets: EventTicket[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [isChild, setIsChild] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    const res = await fetch('/api/admin/events/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, name, description: desc, price_aed: price, cost_price_aed: costPrice, is_child: isChild, sort_order: tickets.length }),
    })
    if (res.ok) {
      // Refresh server data in place - keeps the Manage panel open.
      setName(''); setDesc(''); setPrice(''); setCostPrice(''); setIsChild(false)
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Could not add ticket.')
    }
    setBusy(false)
  }

  async function remove(id: string) {
    if (!confirm('Delete this ticket type?')) return
    const res = await fetch('/api/admin/events/tickets', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    if (res.ok) router.refresh()
    else alert('Could not delete ticket.')
  }

  return (
    <div className="px-6 py-5">
      {tickets.length > 0 ? (
        <div className="space-y-2 mb-4">
          {tickets.map(t => (
            editingId === t.id ? (
              <EditTicketRow
                key={t.id}
                ticket={t}
                onCancel={() => setEditingId(null)}
                onSaved={() => { setEditingId(null); router.refresh() }}
              />
            ) : (
              <div key={t.id} className="flex items-center justify-between bg-charcoal-700/50 rounded-lg px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium flex items-center gap-2">
                    <Ticket size={14} className="text-gold-400" /> {t.name}
                    <span className="text-gold-400 font-semibold">{t.price_aed === 0 ? 'Free' : `${t.price_aed} AED`}</span>
                    {t.cost_price_aed != null && (
                      <span className="text-gray-500 text-xs font-normal">(cost {t.cost_price_aed} AED, internal only)</span>
                    )}
                    {t.is_child && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Child - asks for age</span>
                    )}
                  </p>
                  {t.description && <p className="text-gray-500 text-xs mt-0.5 ml-6">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditingId(t.id)} className="text-gray-500 hover:text-white p-1.5" title="Edit ticket">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(t.id)} className="text-gray-500 hover:text-red-400 p-1.5" title="Delete ticket">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm mb-4">No tickets yet. Add at least one so people can register.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
        <div className="sm:col-span-4">
          <label className="block text-xs text-gray-500 mb-1">Ticket name</label>
          <Inp value={name} onChange={setName} placeholder="Alcohol package" />
        </div>
        <div className="sm:col-span-4">
          <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
          <Inp value={desc} onChange={setDesc} placeholder="Includes house drinks" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Price (AED)</label>
          <Inp type="number" value={price} onChange={setPrice} placeholder="250" />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">Cost (AED)</label>
          <Inp type="number" value={costPrice} onChange={setCostPrice} placeholder="150" />
        </div>
        <div className="sm:col-span-1">
          <button onClick={add} disabled={busy}
            className="w-full inline-flex items-center justify-center bg-gold-500 hover:bg-gold-600 text-white h-[38px] rounded-lg font-semibold disabled:opacity-50" title="Add ticket">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
          </button>
        </div>
      </div>
      <label className="inline-flex items-center gap-2 mt-3 text-sm text-gray-300 cursor-pointer">
        <input type="checkbox" checked={isChild} onChange={e => setIsChild(e.target.checked)} className="h-4 w-4 accent-gold-500" />
        Is this a child ticket? (the booking form will ask for each child&rsquo;s age)
      </label>
      <p className="text-gray-500 text-xs mt-2">Set price to 0 for a free ticket (no payment, instant confirmation). Cost price is optional and internal only - it is never shown publicly.</p>
    </div>
  )
}

function EditTicketRow({ ticket, onCancel, onSaved }: {
  ticket: EventTicket; onCancel: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(ticket.name)
  const [desc, setDesc] = useState(ticket.description || '')
  const [price, setPrice] = useState(String(ticket.price_aed))
  const [costPrice, setCostPrice] = useState(ticket.cost_price_aed != null ? String(ticket.cost_price_aed) : '')
  const [isChild, setIsChild] = useState(!!ticket.is_child)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!name.trim()) return setError('Ticket name is required.')
    setBusy(true)
    const res = await fetch('/api/admin/events/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ticket.id, name, description: desc, price_aed: price, cost_price_aed: costPrice, is_child: isChild }),
    })
    if (res.ok) {
      onSaved()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not save ticket.')
      setBusy(false)
    }
  }

  return (
    <div className="bg-charcoal-700/50 border border-gold-500/40 rounded-lg p-3">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
        <div className="sm:col-span-4">
          <label className="block text-xs text-gray-500 mb-1">Ticket name</label>
          <Inp value={name} onChange={setName} placeholder="Alcohol package" />
        </div>
        <div className="sm:col-span-4">
          <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
          <Inp value={desc} onChange={setDesc} placeholder="Includes house drinks" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Price (AED)</label>
          <Inp type="number" value={price} onChange={setPrice} placeholder="250" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Cost (AED)</label>
          <Inp type="number" value={costPrice} onChange={setCostPrice} placeholder="150" />
        </div>
      </div>
      <label className="inline-flex items-center gap-2 mt-3 text-sm text-gray-300 cursor-pointer">
        <input type="checkbox" checked={isChild} onChange={e => setIsChild(e.target.checked)} className="h-4 w-4 accent-gold-500" />
        Is this a child ticket? (the booking form will ask for each child&rsquo;s age)
      </label>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={busy}
          className="inline-flex items-center gap-1.5 bg-gold-500 hover:bg-gold-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </button>
        <button onClick={onCancel} disabled={busy}
          className="inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Attendees / door list
// ---------------------------------------------------------------------------
function AttendeesPanel({ eventId, stats, registrations, tickets }: {
  eventId: string
  stats: { total: number; paid: number; tickets: number; refunded: number }
  registrations: EventRegistration[]
  tickets: EventTicket[]
}) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [mode, setMode] = useState<'refund' | 'tickets' | 'email' | 'stripe' | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const sorted = [...registrations].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const visible = showAll ? sorted : sorted.slice(0, 8)

  const dietaryCounts = { vegetarian: 0, vegan: 0, other: 0 }
  registrations.filter(r => r.status === 'paid').forEach(r => {
    const tally = (d?: string | null) => { if (d === 'vegetarian' || d === 'vegan' || d === 'other') dietaryCounts[d] += 1 }
    tally(r.dietary)
    ;(r.guest_names || []).forEach(g => tally(g.dietary))
  })
  const dietaryTotal = dietaryCounts.vegetarian + dietaryCounts.vegan + dietaryCounts.other

  // Money already handed back across the whole event, so it is visible at a
  // glance rather than only inside individual bookings.
  const refundedTotal = registrations.reduce((s, r) => s + (Number(r.refunded_amount_aed) || 0), 0)

  function toggle(id: string, next: 'refund' | 'tickets' | 'email' | 'stripe') {
    if (openId === id && mode === next) { setOpenId(null); setMode(null); return }
    setOpenId(id); setMode(next)
  }

  return (
    <div className="px-6 py-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
        <div className="flex gap-6 flex-wrap">
          <div><p className="text-2xl font-display font-bold text-gold-400">{stats.tickets}</p><p className="text-gray-400 text-xs">Guests (paid tickets)</p></div>
          <div><p className="text-2xl font-display font-bold text-green-400">{stats.paid}</p><p className="text-gray-400 text-xs">Paid bookings</p></div>
          <div><p className="text-2xl font-display font-bold text-white">{stats.total}</p><p className="text-gray-400 text-xs">Total bookings</p></div>
          {stats.refunded > 0 && (
            <div><p className="text-2xl font-display font-bold text-red-400">{stats.refunded}</p><p className="text-gray-400 text-xs">Fully refunded</p></div>
          )}
          {refundedTotal > 0 && (
            <div><p className="text-2xl font-display font-bold text-red-400">{aed(refundedTotal)}</p><p className="text-gray-400 text-xs">AED refunded</p></div>
          )}
          {dietaryTotal > 0 && (
            <div>
              <p className="text-2xl font-display font-bold text-gold-300">{dietaryTotal}</p>
              <p className="text-gray-400 text-xs">
                {[
                  dietaryCounts.vegetarian > 0 && `${dietaryCounts.vegetarian} veg`,
                  dietaryCounts.vegan > 0 && `${dietaryCounts.vegan} vegan`,
                  dietaryCounts.other > 0 && `${dietaryCounts.other} other`,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          <a href={`/api/admin/events/export?eventId=${eventId}`}
            className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Download size={16} /> Download door list (Excel)
          </a>
          <a href={`/api/admin/events/export-costs?eventId=${eventId}`}
            className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            title="Name, email, ticket type, cost price and selling price per attendee - internal only, never shared publicly">
            <Download size={16} /> Download Event Financials
          </a>
        </div>
      </div>

      {registrations.length === 0 ? (
        <p className="text-gray-500 text-sm">No bookings yet.</p>
      ) : (
        <>
          <div className="space-y-3">
            {visible.map(reg => (
              confirmingDeleteId === reg.id ? (
                <ConfirmDeleteRegistration
                  key={reg.id}
                  reg={reg}
                  onCancel={() => setConfirmingDeleteId(null)}
                  onDeleted={() => { setConfirmingDeleteId(null); router.refresh() }}
                />
              ) : (
                <BookingCard
                  key={reg.id}
                  reg={reg}
                  tickets={tickets}
                  open={openId === reg.id ? mode : null}
                  onToggle={next => toggle(reg.id, next)}
                  onClose={() => { setOpenId(null); setMode(null) }}
                  onDone={() => { setOpenId(null); setMode(null); router.refresh() }}
                  onDelete={() => setConfirmingDeleteId(reg.id)}
                />
              )
            ))}
          </div>
          {sorted.length > 8 && (
            <button onClick={() => setShowAll(v => !v)} className="text-gold-400 hover:underline text-xs font-medium mt-3">
              {showAll ? 'Show fewer' : `Show all ${sorted.length} bookings`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

const dietaryLabelFor = (d?: string | null, note?: string | null) =>
  d === 'vegetarian' ? 'Vegetarian' : d === 'vegan' ? 'Vegan' : d === 'other' ? (note ? `Other: ${note}` : 'Other diet') : null

// One booking: the person who paid, with everybody they paid for listed
// underneath. Previously a booking of five showed as a single line saying
// "5 tickets", so there was no way to see who was actually coming, or which
// package each of them held.
function BookingCard({ reg, tickets, open, onToggle, onClose, onDone, onDelete }: {
  reg: EventRegistration
  tickets: EventTicket[]
  open: 'refund' | 'tickets' | 'email' | 'stripe' | null
  onToggle: (next: 'refund' | 'tickets' | 'email' | 'stripe') => void
  onClose: () => void
  onDone: () => void
  onDelete: () => void
}) {
  const guests = reg.guest_names || []
  const refunded = Number(reg.refunded_amount_aed) || 0
  const remaining = Math.round(((Number(reg.amount_aed) || 0) - refunded) * 100) / 100
  const buyerPrice = tickets.find(t => t.id === reg.ticket_id)?.price_aed

  return (
    <div className="bg-charcoal-700/40 border border-charcoal-600 rounded-xl overflow-hidden">

      {/* ---- The purchaser ---- */}
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white text-sm font-semibold truncate">{reg.first_name} {reg.last_name}</p>
            <span className="bg-gold-500/20 text-gold-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              Purchaser
            </span>
            {guests.length > 0 && (
              <span className="text-gray-500 text-xs">paid for {guests.length + 1} people</span>
            )}
          </div>
          <p className="text-gray-500 text-xs truncate mt-0.5">
            {reg.email}{reg.phone ? ` · ${reg.phone}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-white text-sm font-semibold">
              {reg.amount_aed > 0 ? `${aed(reg.amount_aed)} AED` : 'Free'}
            </p>
            {refunded > 0 && (
              <p className="text-red-400 text-xs">{aed(refunded)} refunded</p>
            )}
          </div>
          <RegStatusBadge status={reg.status} />
        </div>
      </div>

      {/* ---- Everyone on the booking, indented under the purchaser ---- */}
      <div className="px-4 pb-3">
        <div className="border-l-2 border-charcoal-600 pl-4 ml-1 space-y-1.5">
          <AttendeeLine
            name={`${reg.first_name} ${reg.last_name}`.trim()}
            role="Purchaser"
            ticketName={reg.ticket_name}
            price={buyerPrice}
            dietary={dietaryLabelFor(reg.dietary, reg.dietary_note)}
            age={reg.attendee_age}
          />
          {guests.map((g, i) => (
            <AttendeeLine
              key={`${g.name}-${i}`}
              name={g.name}
              role={`Guest ${i + 1}`}
              ticketName={g.ticket_name}
              price={g.price_aed}
              dietary={dietaryLabelFor(g.dietary, g.dietary_note)}
              age={g.age}
            />
          ))}
        </div>
      </div>

      {reg.admin_note && (
        <div className="px-4 pb-3">
          <p className="text-gray-500 text-xs whitespace-pre-line border-l-2 border-gold-500/40 pl-3">
            {reg.admin_note}
          </p>
        </div>
      )}

      {/* ---- Actions ---- */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-charcoal-800/60 border-t border-charcoal-600">
        {reg.status === 'paid' && (
          <>
            <button
              onClick={() => onToggle('tickets')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                open === 'tickets' ? 'bg-gold-500 text-white' : 'bg-charcoal-700 hover:bg-charcoal-600 text-gray-300'
              }`}
              title="Move the buyer or a guest onto a different ticket package"
            >
              <Ticket size={13} /> Change tickets
            </button>
            <button
              onClick={() => onToggle('email')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                open === 'email' ? 'bg-gold-500 text-white' : 'bg-charcoal-700 hover:bg-charcoal-600 text-gray-300'
              }`}
              title="Correct the email address and send the ticket confirmation again"
            >
              <Mail size={13} /> Resend confirmation
            </button>
            <button
              onClick={() => onToggle('refund')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                open === 'refund' ? 'bg-gold-500 text-white' : 'bg-charcoal-700 hover:bg-red-500/20 hover:text-red-400 text-gray-300'
              }`}
              title="Refund some or all of this booking through Stripe"
            >
              <Undo2 size={13} /> Refund minus admin fee
            </button>
          </>
        )}
        {reg.amount_aed > 0 && (
          <button
            onClick={() => onToggle('stripe')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              open === 'stripe' ? 'bg-gold-500 text-white' : 'bg-charcoal-700 hover:bg-charcoal-600 text-gray-300'
            }`}
            title="Read this payment straight from Stripe and compare it with what BILD has recorded"
          >
            <ShieldCheck size={13} /> Check against Stripe
          </button>
        )}
        <button
          onClick={onDelete}
          className="ml-auto inline-flex items-center justify-center bg-charcoal-700 hover:bg-red-500/20 hover:text-red-400 text-gray-400 p-1.5 rounded-lg transition-colors"
          title="Delete this booking permanently (e.g. a test entry) - does not process a Stripe refund"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {open === 'tickets' && (
        <ChangeTicketsPanel reg={reg} tickets={tickets} onCancel={onClose} onDone={onDone} />
      )}
      {open === 'refund' && (
        <RefundPanel reg={reg} remaining={remaining} onCancel={onClose} onDone={onDone} />
      )}
      {open === 'email' && (
        <ResendConfirmationPanel reg={reg} onCancel={onClose} onDone={onDone} />
      )}
      {open === 'stripe' && (
        <StripeCheckPanel reg={reg} onCancel={onClose} />
      )}
    </div>
  )
}

function AttendeeLine({ name, role, ticketName, price, dietary, age }: {
  name: string
  role: string
  ticketName?: string | null
  price?: number | null
  dietary: string | null
  age?: number | null
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <div className="min-w-0">
        <span className="text-gray-200">{name || <em className="text-gray-600">Unnamed</em>}</span>
        <span className="text-gray-600 text-xs ml-2">{role}</span>
        {age != null && <span className="text-blue-300 text-xs ml-2">age {age}</span>}
        {dietary && <span className="text-gold-400 text-xs ml-2">{dietary}</span>}
      </div>
      <div className="shrink-0 text-right">
        <span className="text-gray-400 text-xs">{ticketName || 'Ticket'}</span>
        {price != null && <span className="text-gray-500 text-xs ml-2">{price > 0 ? `${aed(price)} AED` : 'Free'}</span>}
      </div>
    </div>
  )
}

// Reads this booking's payment straight out of Stripe and puts it next to what
// BILD has recorded. Written after a refund that BILD showed could not be found
// in the Stripe dashboard. It was there, but proving that meant reading the
// database by hand. Read-only: it never refunds, and never writes anything.
function StripeCheckPanel({ reg, onCancel }: { reg: EventRegistration; onCancel: () => void }) {
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<StripeCheck | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      setBusy(true)
      setError('')
      const res = await fetch(`/api/admin/events/registrations/stripe-check?id=${reg.id}`)
      const d = await res.json().catch(() => ({}))
      if (!live) return
      setBusy(false)
      if (!res.ok) return setError(d.error || 'Could not read this payment from Stripe.')
      setData(d)
    })()
    return () => { live = false }
  }, [reg.id])

  const verdictStyles: Record<string, string> = {
    match: 'bg-green-500/10 border-green-500/40 text-green-400',
    mismatch: 'bg-red-500/10 border-red-500/40 text-red-400',
    'not-found': 'bg-red-500/10 border-red-500/40 text-red-400',
    'no-payment': 'bg-charcoal-700/60 border-charcoal-600 text-gray-400',
  }

  return (
    <div className="px-4 py-4 border-t border-charcoal-600 bg-charcoal-900/50">
      <p className="text-white text-sm font-semibold mb-1">Check against Stripe</p>
      <p className="text-gray-500 text-xs mb-3">
        Read straight from Stripe just now. Nothing here changes the booking or moves any money.
      </p>

      {busy && (
        <p className="text-gray-400 text-sm inline-flex items-center gap-2">
          <Loader2 size={15} className="animate-spin" /> Asking Stripe...
        </p>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {data && (
        <>
          <div className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 text-sm ${verdictStyles[data.verdict] || verdictStyles['no-payment']}`}>
            {data.verdict === 'match'
              ? <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
            <span>{data.message}</span>
          </div>

          {data.stripe && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="bg-charcoal-800/60 border border-charcoal-600 rounded-lg p-3">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">BILD records</p>
                  <Line label="Ticket value" value={`${aed(data.bild.ticketValueAed)} AED`} />
                  <Line label="Refunded" value={`${aed(data.bild.refundedAed)} AED`} />
                  <Line label="Status" value={data.bild.status} />
                </div>
                <div className="bg-charcoal-800/60 border border-charcoal-600 rounded-lg p-3">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Stripe says</p>
                  <Line label="Card charged" value={`${aed(data.stripe.chargedAed)} AED`} />
                  <Line label="Refunded" value={`${aed(data.stripe.refundedAed)} AED`} />
                  <Line label="Refunds issued" value={String(data.stripe.refunds.length)} />
                </div>
              </div>

              <p className="text-gray-600 text-xs mt-2">
                The card charge is higher than the ticket value by the card fee passed on at checkout, so those two are
                not meant to agree. The refunded figures are.
              </p>

              {data.stripe.refunds.length > 0 && (
                <div className="mt-3">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Refunds on this payment</p>
                  <div className="space-y-1">
                    {data.stripe.refunds.map(r => (
                      <div key={r.id} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-gray-500 font-mono truncate">{r.id}</span>
                        <span className="text-gray-300 shrink-0">
                          {aed(r.amountAed)} AED · {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <a
                href={data.stripe.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-gold-400 hover:underline text-xs font-semibold mt-3"
              >
                Open this payment in Stripe <ExternalLink size={12} />
              </a>
            </>
          )}
        </>
      )}

      <div className="mt-4">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white">
          Close
        </button>
      </div>
    </div>
  )
}

type StripeCheck = {
  verdict: 'match' | 'mismatch' | 'not-found' | 'no-payment'
  message: string
  bild: { status: string; ticketValueAed: number; refundedAed: number }
  stripe: null | {
    chargeId: string
    paymentIntentId: string
    chargedAed: number
    refundedAed: number
    paidAt: string | null
    dashboardUrl: string
    refunds: { id: string; amountAed: number; status: string | null; createdAt: string; reason: string | null }[]
  }
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm py-0.5">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  )
}

// Reassigns packages for the buyer and each guest in one go. The new booking
// total is worked out live, so the difference is visible before saving.
function ChangeTicketsPanel({ reg, tickets, onCancel, onDone }: {
  reg: EventRegistration
  tickets: EventTicket[]
  onCancel: () => void
  onDone: () => void
}) {
  const guests = reg.guest_names || []
  const byName = new Map(tickets.map(t => [t.name, t]))
  const [buyerTicketId, setBuyerTicketId] = useState<string>(
    reg.ticket_id || byName.get(reg.ticket_name || '')?.id || tickets[0]?.id || ''
  )
  const [guestTicketIds, setGuestTicketIds] = useState<string[]>(
    guests.map(g => byName.get(g.ticket_name || '')?.id || tickets[0]?.id || '')
  )
  const [note, setNote] = useState('')
  const [refundDifference, setRefundDifference] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const priceOf = (id: string) => tickets.find(t => t.id === id)?.price_aed ?? 0
  const newTotal = priceOf(buyerTicketId) + guestTicketIds.reduce((s, id) => s + priceOf(id), 0)
  const difference = Math.round(((Number(reg.amount_aed) || 0) - newTotal) * 100) / 100

  async function save() {
    setError('')
    setBusy(true)
    const res = await fetch('/api/admin/events/registrations/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: reg.id, buyerTicketId, guestTicketIds, note,
        refundDifference: difference > 0 && refundDifference,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d.error || 'Could not change the tickets.')
    // The tickets changed even if the refund did not, so the error is shown
    // rather than the panel silently closing on a half-done job.
    if (d.refundError) {
      return setError(`Tickets updated, but the refund failed: ${d.refundError} Use the Refund button to try again.`)
    }
    if (d.refund && d.refund.emailed === false) {
      return setError(
        `Tickets updated and ${aed(d.refund.refundedAed)} AED refunded, but the confirmation email could not be sent: ${d.refund.emailError || 'unknown reason'} Let them know another way.`,
      )
    }
    onDone()
  }

  const select = 'bg-charcoal-900 border border-charcoal-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-gold-500 max-w-[15rem]'
  const label = (t: EventTicket) => `${t.name} · ${t.price_aed > 0 ? `${t.price_aed} AED` : 'Free'}`

  if (tickets.length === 0) {
    return (
      <div className="px-4 py-4 border-t border-charcoal-600 bg-charcoal-900/50">
        <p className="text-gray-400 text-sm">This event has no ticket types set up, so there is nothing to change to.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 border-t border-charcoal-600 bg-charcoal-900/50">
      <p className="text-white text-sm font-semibold mb-3">Change tickets</p>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-300 text-sm truncate">
            {reg.first_name} {reg.last_name} <span className="text-gray-600 text-xs ml-1">Purchaser</span>
          </span>
          <select value={buyerTicketId} onChange={e => setBuyerTicketId(e.target.value)} className={select}>
            {tickets.map(t => <option key={t.id} value={t.id}>{label(t)}</option>)}
          </select>
        </div>
        {guests.map((g, i) => (
          <div key={`${g.name}-${i}`} className="flex items-center justify-between gap-3">
            <span className="text-gray-300 text-sm truncate">
              {g.name || `Guest ${i + 1}`} <span className="text-gray-600 text-xs ml-1">Guest {i + 1}</span>
            </span>
            <select
              value={guestTicketIds[i]}
              onChange={e => setGuestTicketIds(ids => ids.map((v, j) => (j === i ? e.target.value : v)))}
              className={select}
            >
              {tickets.map(t => <option key={t.id} value={t.id}>{label(t)}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 py-2.5 border-y border-charcoal-700 mb-3 text-sm">
        <span className="text-gray-400">Booking total</span>
        <span className="text-white font-semibold">
          {aed(reg.amount_aed)} AED <span className="text-gray-600">to</span> {aed(newTotal)} AED
        </span>
      </div>

      {difference > 0 && (
        <div className="bg-charcoal-800 border border-charcoal-600 rounded-lg p-3 mb-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={refundDifference}
              onChange={e => setRefundDifference(e.target.checked)}
              className="accent-gold-500 w-4 h-4 mt-0.5 shrink-0"
            />
            <span className="text-sm text-gray-200 leading-relaxed">
              Refund the difference of <strong className="text-white">{aed(difference)} AED</strong> to the buyer now
              <span className="block text-gray-500 text-xs mt-0.5">
                Sent back to their card through Stripe as part of saving, with a refund confirmation emailed to
                them and copied to the BILD inbox. They stay on the door list.
              </span>
            </span>
          </label>
          {!refundDifference && (
            <p className="text-amber-400/90 text-xs mt-2 pl-7 leading-relaxed">
              The record will be corrected but the buyer keeps nothing back. You can refund later with the Refund
              button.
            </p>
          )}
        </div>
      )}
      {difference < 0 && (
        <p className="text-amber-400/90 text-xs mb-3 leading-relaxed">
          This is an upgrade of {aed(Math.abs(difference))} AED. Stripe cannot charge more to a card that has already
          been used, so collect the difference separately.
        </p>
      )}

      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Why (optional), e.g. moved to soft drinks package"
        className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500 mb-3"
      />

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="flex gap-2">
        <button onClick={save} disabled={busy}
          className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {difference > 0 && refundDifference ? `Save and refund ${aed(difference)} AED` : 'Save tickets'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  )
}

// Refunds part or all of a booking. A part refund leaves the booking live and
// the person still on the door list; a full one ends it.
function ResendConfirmationPanel({ reg, onCancel, onDone }: {
  reg: EventRegistration
  onCancel: () => void
  onDone: () => void
}) {
  const [email, setEmail] = useState(reg.email)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  const changed = email.trim().toLowerCase() !== (reg.email || '').toLowerCase()

  async function send() {
    setError('')
    setBusy(true)
    const res = await fetch('/api/admin/events/registrations/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reg.id, email }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d.error || 'Could not send the confirmation.')
    setSentTo(d.sentTo || email)
    setTimeout(onDone, 1600)
  }

  return (
    <div className="px-4 py-4 border-t border-charcoal-600 bg-charcoal-900/50">
      <p className="text-white text-sm font-semibold mb-1">Resend confirmation</p>
      <p className="text-gray-500 text-xs mb-3">
        Correct the address if it is wrong, then send the ticket confirmation again.
      </p>

      {sentTo ? (
        <p className="text-green-400 text-sm">Sent to {sentTo}.</p>
      ) : (
        <>
          <label className="block mb-3">
            <span className="text-gray-400 text-xs block mb-1">Email address</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full max-w-md bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500"
            />
          </label>
          {changed && (
            <p className="text-gold-400 text-xs mb-3">
              This also corrects the address on the booking, and the change is recorded in the notes.
            </p>
          )}
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <button onClick={send} disabled={busy}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Send confirmation
            </button>
            <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function RefundPanel({ reg, remaining, onCancel, onDone }: {
  reg: EventRegistration
  remaining: number
  onCancel: () => void
  onDone: () => void
}) {
  // A full refund is the exception: BILD normally keeps an admin fee when a
  // member cannot attend. So the fee is what gets typed, and the amount going
  // back to the buyer is worked out from it, rather than the other way round.
  const [gross, setGross] = useState(String(remaining))
  const [fee, setFee] = useState(() => {
    if (typeof window === 'undefined') return ''
    // Remembers the fee last used on this browser, since it is usually the
    // same figure every time.
    try { return window.localStorage.getItem('bild:adminFee') || '' } catch { return '' }
  })
  const [note, setNote] = useState('')
  // Getting money back and still coming are separate questions. Refunding the
  // whole booking almost always means a cancellation, so that is the default,
  // but a fee kept back must not silently leave them on the door list.
  const [notAttending, setNotAttending] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const grossValue = parseFloat(gross)
  const feeValue = fee.trim() === '' ? 0 : parseFloat(fee)
  const validGross = Number.isFinite(grossValue) && grossValue > 0
  const validFee = Number.isFinite(feeValue) && feeValue >= 0
  const payout = validGross && validFee ? Math.round((grossValue - feeValue) * 100) / 100 : NaN
  const refundingWholeBooking = validGross && grossValue >= remaining

  async function submit() {
    setError('')
    if (!validGross) return setError('Please enter the amount being refunded.')
    if (grossValue > remaining) return setError(`Only ${aed(remaining)} AED is left on this booking.`)
    if (!validFee) return setError('Please enter a valid admin fee, or leave it blank.')
    if (!Number.isFinite(payout) || payout <= 0) {
      return setError('The admin fee cannot be the whole amount. Nothing would go back to the buyer.')
    }

    const label = `${reg.first_name} ${reg.last_name}`.trim()
    const feeLine = feeValue > 0 ? ` BILD keeps ${aed(feeValue)} AED as an admin fee.` : ''
    const listLine = notAttending
      ? ' The booking comes off the door list.'
      : ' The booking stays on the door list.'
    if (!confirm(`Send ${aed(payout)} AED back to ${label} via Stripe?${feeLine}${listLine}`)) return

    setBusy(true)
    const reason = [
      feeValue > 0 ? `admin fee ${aed(feeValue)} AED retained` : null,
      notAttending ? 'no longer attending' : null,
      note.trim() || null,
    ].filter(Boolean).join(', ')

    const res = await fetch('/api/admin/events/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reg.id, amountAed: payout, note: reason, notAttending, adminFeeAed: feeValue }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d.error || 'Could not process the refund.')
    try { window.localStorage.setItem('bild:adminFee', fee.trim()) } catch { /* private window */ }
    // The money moved either way. Only the email is in doubt, so say so
    // rather than letting the panel close as though everything worked.
    if (d.emailed === false) {
      return setError(
        `The refund of ${aed(payout)} AED went through, but the confirmation email could not be sent: ${d.emailError || 'unknown reason'} Let them know another way.`,
      )
    }
    onDone()
  }

  const field = 'w-32 bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500'

  return (
    <div className="px-4 py-4 border-t border-charcoal-600 bg-charcoal-900/50">
      <p className="text-white text-sm font-semibold mb-1">Refund minus admin fee</p>
      <p className="text-gray-500 text-xs mb-3">{aed(remaining)} AED left on this booking.</p>

      <div className="flex flex-wrap items-end gap-4 mb-3">
        <label className="block">
          <span className="text-gray-400 text-xs block mb-1">Amount being refunded</span>
          <input
            type="number" min="0" step="0.01" max={remaining}
            value={gross}
            onChange={e => setGross(e.target.value)}
            className={field}
          />
        </label>
        <span className="text-gray-600 text-lg pb-2">&minus;</span>
        <label className="block">
          <span className="text-gray-400 text-xs block mb-1">Admin fee BILD keeps</span>
          <input
            type="number" min="0" step="0.01"
            value={fee}
            onChange={e => setFee(e.target.value)}
            placeholder="0.00"
            autoFocus
            className={field}
          />
        </label>
        <span className="text-gray-600 text-lg pb-2">=</span>
        <div className="pb-1">
          <span className="text-gray-400 text-xs block mb-1">Buyer receives</span>
          <p className={`font-display text-2xl font-bold leading-none ${Number.isFinite(payout) && payout > 0 ? 'text-green-400' : 'text-gray-600'}`}>
            {Number.isFinite(payout) && payout > 0 ? `${aed(payout)} AED` : '-'}
          </p>
        </div>
      </div>

      <div className="bg-charcoal-800 border border-charcoal-600 rounded-lg p-3 mb-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={notAttending}
            onChange={e => setNotAttending(e.target.checked)}
            className="accent-gold-500 w-4 h-4 mt-0.5 shrink-0"
          />
          <span className="text-sm text-gray-200 leading-relaxed">
            They are no longer attending
            <span className="block text-gray-500 text-xs mt-0.5">
              Removes the whole booking from the door list, the ticket count and the capacity, and frees the
              {reg.quantity > 1 ? ` ${reg.quantity} seats` : ' seat'} for someone else. The admin fee you keep still
              counts as revenue.
            </span>
          </span>
        </label>
        {!notAttending && (
          <p className="text-amber-400/90 text-xs mt-2 pl-7 leading-relaxed">
            They stay on the door list and keep their {reg.quantity > 1 ? 'seats' : 'seat'}. Right when a guest has
            dropped out of a larger booking, or a ticket was downgraded.
          </p>
        )}
        {notAttending && !refundingWholeBooking && (
          <p className="text-amber-400/90 text-xs mt-2 pl-7 leading-relaxed">
            You are refunding part of the booking but removing all of it. If only one guest has dropped out, untick
            this so the rest stay on the door list.
          </p>
        )}
      </div>

      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Why (optional), e.g. cannot attend, family illness"
        className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500 mb-3"
      />

      <p className="text-gray-500 text-xs mb-3 inline-flex items-center gap-1.5">
        <Mail size={12} />
        {reg.email
          ? <>A refund confirmation goes to {reg.email}, copied to the BILD inbox.</>
          : <>No email address on this booking, so no confirmation can be sent.</>}
      </p>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="flex gap-2">
        <button onClick={submit} disabled={busy}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />}
          Refund {Number.isFinite(payout) && payout > 0 ? `${aed(payout)} AED` : ''}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  )
}

function ConfirmDeleteRegistration({ reg, onCancel, onDeleted }: {
  reg: EventRegistration; onCancel: () => void; onDeleted: () => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const label = `${reg.first_name} ${reg.last_name}`.trim()

  async function del() {
    setError('')
    if (!password) return setError('Please enter the admin password.')
    setBusy(true)
    const res = await fetch('/api/admin/events/registrations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reg.id, password }),
    })
    if (res.ok) {
      onDeleted()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not delete the application.')
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
      <p className="text-red-300 text-sm font-semibold">Delete {label}&rsquo;s application?</p>
      <p className="text-red-200/80 text-xs mt-1 mb-3">
        This permanently removes it and cannot be undone. It does not process any Stripe refund - use Refund
        first if money needs to go back. Enter the admin password to confirm.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') del() }}
          placeholder="Admin password"
          autoFocus
          className="flex-1 max-w-xs px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <div className="flex gap-2">
          <button onClick={del} disabled={busy}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} {busy ? 'Deleting...' : 'Yes, delete'}
          </button>
          <button onClick={onCancel} disabled={busy}
            className="bg-charcoal-700 hover:bg-charcoal-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
      {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
    </div>
  )
}

function RegStatusBadge({ status }: { status: EventRegistration['status'] }) {
  if (status === 'refunded') {
    return <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-500/10 text-red-400 shrink-0">Refunded</span>
  }
  if (status === 'paid') {
    return <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-400 shrink-0">Paid</span>
  }
  return <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-500/10 text-gray-400 shrink-0">Pending</span>
}

// ---------------------------------------------------------------------------
// Gallery manager (past-event photos / videos)
// ---------------------------------------------------------------------------
function GalleryManager({ event }: { event: EventRow }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [igUrl, setIgUrl] = useState('')
  const [addingIg, setAddingIg] = useState(false)
  const gallery: GalleryItem[] = event.gallery || []

  async function addInstagramPost() {
    const url = igUrl.trim()
    if (!url.includes('instagram.com')) { alert('Enter a valid Instagram post URL.'); return }
    setAddingIg(true)
    try {
      const res = await fetch('/api/admin/events/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: event.id, url, type: 'instagram' }),
      })
      if (res.ok) { setIgUrl(''); router.refresh() } else { alert('Could not add that Instagram post.') }
    } finally { setAddingIg(false) }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        // Auto-resize/compress photos; warn on oversized videos (no in-browser transcode).
        let toUpload = file
        if (file.type.startsWith('image/')) {
          toUpload = await compressImage(file)
        } else if (file.type.startsWith('video/') && file.size > 25 * 1024 * 1024) {
          const mb = Math.round(file.size / (1024 * 1024))
          if (!confirm(`"${file.name}" is ${mb} MB. Large videos are slow to load and use a lot of storage - we recommend compressing videos before uploading. Upload anyway?`)) continue
        }
        let url: string
        try {
          const up = await uploadViaSignedUrl({ kind: 'event-media', file: toUpload, eventId: event.id })
          if (!up.publicUrl) throw new Error('No URL returned')
          url = up.publicUrl
        } catch (err) {
          alert(err instanceof Error ? `${file.name}: ${err.message}` : `Upload failed for ${file.name}`)
          continue
        }
        const type = toUpload.type.startsWith('video') ? 'video' : 'image'
        await fetch('/api/admin/events/media', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: event.id, url, type }),
        })
      }
      router.refresh()
    } finally { setUploading(false) }
  }

  async function remove(url: string) {
    if (!confirm('Remove this item?')) return
    const res = await fetch('/api/admin/events/media', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: event.id, url }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div className="px-6 py-5">
      {gallery.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
          {gallery.map((g, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden bg-charcoal-900 aspect-square">
              {g.type === 'video' ? (
                <video src={g.url} className="w-full h-full object-cover" />
              ) : g.type === 'instagram' ? (
                <a href={g.url} target="_blank" rel="noopener noreferrer" title={g.url}
                  className="w-full h-full flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <FaInstagram size={28} />
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.url} alt="" className="w-full h-full object-cover" />
              )}
              <button onClick={() => remove(g.url)}
                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          {uploading ? 'Uploading...' : 'Upload photos / videos'}
          <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => onFiles(e.target.files)} disabled={uploading} />
        </label>
        <div className="inline-flex items-center gap-2">
          <input
            type="text"
            value={igUrl}
            onChange={e => setIgUrl(e.target.value)}
            placeholder="Instagram post URL"
            className="px-3 py-2.5 bg-charcoal-800 border border-charcoal-600 rounded-xl text-white text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <button
            onClick={addInstagramPost}
            disabled={addingIg || !igUrl.trim()}
            className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {addingIg ? <Loader2 size={16} className="animate-spin" /> : <FaInstagram size={16} />}
            Add
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-xs mt-2">These appear on the event page once it has passed. Instagram posts render as their own embedded card, separate from the photo grid.</p>
    </div>
  )
}

function DeleteEvent({ id, title }: { id: string; title: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function del() {
    setError('')
    if (!password) return setError('Please enter the admin password.')
    setBusy(true)
    const res = await fetch('/api/admin/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not delete event.')
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <button onClick={() => { setConfirming(true); setError(''); setPassword('') }}
        className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium">
        <Trash2 size={15} /> Delete this event
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
      <p className="text-red-300 text-sm font-semibold">Delete &ldquo;{title}&rdquo;?</p>
      <p className="text-red-200/80 text-xs mt-1 mb-3">
        This permanently removes the event, its tickets, all registrations and the door list. This cannot be undone.
        Enter the admin password to confirm.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') del() }}
          placeholder="Admin password"
          autoFocus
          className="flex-1 max-w-xs px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <div className="flex gap-2">
          <button onClick={del} disabled={busy}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} {busy ? 'Deleting...' : 'Yes, delete'}
          </button>
          <button onClick={() => { setConfirming(false); setError(''); setPassword('') }} disabled={busy}
            className="bg-charcoal-700 hover:bg-charcoal-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
      {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small field helpers
// ---------------------------------------------------------------------------
function FField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}
function Inp({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500" />
  )
}
