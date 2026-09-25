'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  UserPlus, Briefcase, PartyPopper, TicketCheck, ArrowRight,
  Crown, Users, Store, CalendarCheck, TrendingUp, Ticket, ClipboardList, CalendarDays,
  ShieldAlert, UserX, CheckCircle2, CheckCircle, Clock, XCircle, BarChart3, Hash,
  ChevronDown, ChevronUp, MailWarning, Send, Loader2,
  Link2Off as LinkIcon,
} from 'lucide-react'
import Reveal from '@/components/anim/Reveal'
import CountUp from '@/components/anim/CountUp'

type WeekPoint = { label: string; value: number }
type EventRow = { id: string; title: string; date: string; bookings: number; tickets: number }

type DashboardData = {
  paidMembers: number
  totalMembers: number
  approvedBiz: number
  pendingBiz: number
  rejectedBiz: number
  upcomingEvents: number
  licensesExpiringSoon: number
  listingsAwaitingPayment: number
  brokenWebsites: number
  listingsRenewingSoon: number
  featuredRenewingSoon: number
  licensesExpired: number
  abandonedCheckouts: number
  staleInvites: number
  newMembersWeek: number
  newBusinessesWeek: number
  newEventsWeek: number
  ticketsWeek: number
  perEvent: EventRow[]
  membersWeekly: WeekPoint[]
  businessesWeekly: WeekPoint[]
  ticketsWeekly: WeekPoint[]
}

// Status palette (fixed - never reused for identity/categorical series).
const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
}

export default function DashboardClient({ data: d }: { data: DashboardData }) {
  const [view, setView] = useState<'numbers' | 'charts'>('numbers')
  const [showPastTickets, setShowPastTickets] = useState(false)

  const attentionItems = [
    d.pendingBiz > 0 && {
      icon: ClipboardList, tone: 'yellow' as const, count: d.pendingBiz,
      label: d.pendingBiz === 1 ? 'business submission needs review' : 'business submissions need review',
      href: '/admin/directory',
    },
    d.licensesExpiringSoon > 0 && {
      icon: ShieldAlert, tone: 'orange' as const, count: d.licensesExpiringSoon,
      label: d.licensesExpiringSoon === 1 ? 'document expires within 3 days' : 'documents expire within 3 days',
      href: '/admin/directory?tab=licenses',
    },
    d.licensesExpired > 0 && {
      icon: Store, tone: 'red' as const, count: d.licensesExpired,
      label: d.licensesExpired === 1 ? 'listing removed for an expired document' : 'listings removed for expired documents',
      href: '/admin/directory?tab=licenses',
    },
    d.abandonedCheckouts > 0 && {
      icon: UserX, tone: 'blue' as const, count: d.abandonedCheckouts,
      label: d.abandonedCheckouts === 1 ? 'visitor started joining but never paid' : 'visitors started joining but never paid',
      href: '/admin/members?abandoned=1',
    },
    d.staleInvites > 0 && {
      icon: MailWarning, tone: 'orange' as const, count: d.staleInvites,
      label: d.staleInvites === 1
        ? 'member’s WhatsApp invite link may not have reached them (opened but never confirmed)'
        : 'members’ WhatsApp invite links may not have reached them (opened but never confirmed)',
      href: '/admin/members?staleInvite=1',
    },
  ].filter(Boolean) as { icon: React.ElementType; tone: 'yellow' | 'orange' | 'red' | 'blue'; count: number; label: string; href: string }[]

  const maxTickets = Math.max(1, ...d.perEvent.map(e => e.tickets))
  const now = Date.now()
  const upcomingEvents = d.perEvent.filter(e => new Date(e.date).getTime() >= now)
  const pastEventsCount = d.perEvent.length - upcomingEvents.length
  const visibleEvents = showPastTickets ? d.perEvent : upcomingEvents

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Reveal className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-gray-400 text-sm">Here&rsquo;s what has happened in the last 7 days.</p>
        </div>
        <div className="inline-flex rounded-xl bg-charcoal-800 border border-charcoal-700 p-1 self-start">
          <button
            onClick={() => setView('numbers')}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'numbers' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Hash size={14} /> Numbers
          </button>
          <button
            onClick={() => setView('charts')}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'charts' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <BarChart3 size={14} /> Charts
          </button>
        </div>
      </Reveal>

      {/* Needs attention - surfaced first so nothing actionable gets missed */}
      {attentionItems.length > 0 ? (
        <Reveal className="mb-12">
          <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
            <ShieldAlert size={22} className="text-orange-400" /> Needs your attention
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attentionItems.map((item, i) => (
              <AttentionCard key={i} {...item} />
            ))}
          </div>
        </Reveal>
      ) : (
        <Reveal className="mb-12">
          <div className="flex items-center gap-4 bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-4">
            <span className="w-11 h-11 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 size={22} className="text-green-400" />
            </span>
            <p className="text-green-200 text-sm">All caught up - nothing needs your attention right now.</p>
          </div>
        </Reveal>
      )}

      <>
        {view === 'numbers' ? (
          <div key="numbers-week" className="mb-12 animate-step-in">
            {/* This week */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={UserPlus} label="New members" value={d.newMembersWeek} sub="this week" tone="gold" href="/admin/members" />
              <StatCard icon={Briefcase} label="New businesses" value={d.newBusinessesWeek} sub="this week" tone="green" href="/admin/directory" />
              <StatCard icon={PartyPopper} label="New events" value={d.newEventsWeek} sub="this week" tone="blue" href="/admin/events" />
              <StatCard icon={TicketCheck} label="Tickets sold" value={d.ticketsWeek} sub="this week" tone="purple" href="/admin/events" />
            </div>
          </div>
        ) : (
          <div key="charts-week" className="mb-12 animate-step-in">
            <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={22} className="text-gold-400" /> Last {d.membersWeekly.length} weeks
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <WeeklyBarChart title="New members" data={d.membersWeekly} />
              <WeeklyBarChart title="New businesses" data={d.businessesWeekly} />
              <WeeklyBarChart title="Tickets sold" data={d.ticketsWeekly} />
            </div>
          </div>
        )}
      </>

      {/* Totals - always shown as numbers; current-state counts, not trends */}
      <Reveal>
        <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={22} className="text-gold-400" /> Overall (Since Mid 2025)
        </h2>
      </Reveal>
      <Reveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4" stagger={0.07} y={24}>
        <MiniStat icon={Crown} label="Paid members" value={d.paidMembers} />
        <MiniStat icon={Users} label="Total members" value={d.totalMembers} />
        <MiniStat icon={Store} label="Businesses listed" value={d.approvedBiz} />
        <MiniStat icon={CalendarCheck} label="Upcoming events" value={d.upcomingEvents} />
      </Reveal>
      <Reveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12" stagger={0.07} y={24}>
        <Link href="/admin/directory?tab=licenses">
          <MiniStat icon={ShieldAlert} label="Documents expiring in 3 days" value={d.licensesExpiringSoon} tone="orange" />
        </Link>
        <Link href="/admin/directory?tab=licenses">
          <MiniStat icon={Store} label="Listings removed (expired document)" value={d.licensesExpired} tone="red" />
        </Link>
        {/* One card per grid cell. These two shared a single Link, so the
            grid held seven cards in six cells and one column ran double
            height against the others. */}
        <Link href="/admin/members?abandoned=1">
          <MiniStat icon={UserX} label="Started join, never paid" value={d.abandonedCheckouts} tone="blue" />
        </Link>
        <Link href="/admin/members?abandoned=1">
          <MiniStat icon={MailWarning} label="Invite link opened, not confirmed" value={d.staleInvites} tone="orange" />
        </Link>
        <Link href="/admin/directory?tab=billing">
          <MiniStat icon={ShieldAlert} label="Business awaiting payment" value={d.listingsAwaitingPayment} tone="orange" />
        </Link>
        <Link href="/admin/directory?tab=billing">
          <MiniStat icon={ShieldAlert} label="Listings renewing soon" value={d.listingsRenewingSoon} tone="orange" />
        </Link>
        <Link href="/admin/directory?tab=billing">
          <MiniStat icon={Crown} label="Featured renewing soon" value={d.featuredRenewingSoon} tone="orange" />
        </Link>
        <Link href="/admin/directory?tab=links">
          <MiniStat icon={LinkIcon} label="Business websites not working" value={d.brokenWebsites} tone="red" />
        </Link>
      </Reveal>

      {view === 'charts' && (
        <Reveal className="mb-12">
          <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Briefcase size={22} className="text-gold-400" /> Business directory status
          </h2>
          <StatusBreakdownBar approved={d.approvedBiz} pending={d.pendingBiz} rejected={d.rejectedBiz} />
        </Reveal>
      )}

      {/* Tickets per event */}
      <Reveal>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <Ticket size={22} className="text-gold-400" /> Tickets sold per event
          </h2>
          <div className="flex items-center gap-4 flex-wrap">
            <EmailReportButton />
            {pastEventsCount > 0 && (
              <button
                onClick={() => setShowPastTickets(v => !v)}
                className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-semibold"
              >
                {showPastTickets ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                {showPastTickets ? 'Hide past events' : `See past events (${pastEventsCount})`}
              </button>
            )}
          </div>
        </div>
      </Reveal>
      {d.perEvent.length === 0 ? (
        <Reveal>
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden text-center py-12">
            <CalendarDays size={36} className="text-charcoal-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No events yet.</p>
          </div>
        </Reveal>
      ) : visibleEvents.length === 0 ? (
        <Reveal>
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden text-center py-12">
            <CalendarDays size={36} className="text-charcoal-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No upcoming events.</p>
          </div>
        </Reveal>
      ) : (
      <>
        {view === 'charts' ? (
          <div key="tickets-chart" className="animate-step-in">
            <EventsBarChart events={visibleEvents} />
          </div>
        ) : (
        <div
          key="tickets-table"
          className="animate-step-in"
        >
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-charcoal-700">
                    <th className="px-5 py-3 font-medium">Event</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium text-right">Bookings</th>
                    <th className="px-5 py-3 font-medium text-right">Tickets</th>
                    <th className="px-5 py-3 font-medium w-32">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEvents.map(e => (
                    <tr
                      key={e.id}
                      onClick={() => { window.location.href = `/admin/events?event=${e.id}` }}
                      className="border-b border-charcoal-700/60 hover:bg-charcoal-700/40 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3 text-white font-medium">{e.title}</td>
                      <td className="px-5 py-3 text-gray-400">
                        {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-right">{e.bookings}</td>
                      <td className="px-5 py-3 text-right"><span className="text-gold-400 font-semibold text-base">{e.tickets}</span></td>
                      <td className="px-5 py-3">
                        <span className="block h-2 rounded-full bg-charcoal-700 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all duration-700"
                            style={{ width: `${Math.round((e.tickets / maxTickets) * 100)}%` }}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}
      </>
      )}
    </div>
  )
}

const TONES: Record<string, { text: string; tile: string; ring: string }> = {
  gold:   { text: 'text-gold-400',   tile: 'bg-gold-500/15',   ring: 'hover:border-gold-500/50' },
  green:  { text: 'text-green-400',  tile: 'bg-green-500/15',  ring: 'hover:border-green-500/50' },
  blue:   { text: 'text-blue-400',   tile: 'bg-blue-500/15',   ring: 'hover:border-blue-500/50' },
  purple: { text: 'text-purple-400', tile: 'bg-purple-500/15', ring: 'hover:border-purple-500/50' },
}

const ATTENTION_TONES: Record<string, { text: string; bg: string; border: string; hoverBg: string }> = {
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', hoverBg: 'hover:bg-yellow-500/15' },
  orange: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', hoverBg: 'hover:bg-orange-500/15' },
  red:    { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    hoverBg: 'hover:bg-red-500/15' },
  blue:   { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   hoverBg: 'hover:bg-blue-500/15' },
}

function AttentionCard({ icon: Icon, tone, count, label, href }: {
  icon: React.ElementType; tone: keyof typeof ATTENTION_TONES; count: number; label: string; href: string
}) {
  const t = ATTENTION_TONES[tone]
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 ${t.bg} border ${t.border} rounded-2xl px-5 py-4 ${t.hoverBg} transition-colors group`}
    >
      <span className={`w-11 h-11 rounded-xl ${t.bg} flex items-center justify-center shrink-0`}>
        <Icon size={22} className={t.text} />
      </span>
      <p className="text-gray-200 text-sm flex-1">
        <strong className={`text-base ${t.text}`}>{count}</strong> {label}.
      </p>
      <ArrowRight size={20} className={`${t.text} group-hover:translate-x-1 transition-transform shrink-0`} />
    </Link>
  )
}

function StatCard({ icon: Icon, label, value, sub, tone, href }: {
  icon: React.ElementType; label: string; value: number; sub: string; tone: string; href: string
}) {
  const t = TONES[tone] || TONES.gold
  return (
    <Link
      href={href}
      className={`group bg-charcoal-800 border border-charcoal-700 rounded-2xl p-6 block transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 ${t.ring}`}
    >
      <span className={`w-14 h-14 rounded-2xl ${t.tile} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
        <Icon size={28} className={t.text} strokeWidth={1.75} />
      </span>
      <p className={`font-display text-5xl font-bold ${t.text} leading-none tracking-tight`}>
        <CountUp value={String(value)} />
      </p>
      <p className="text-white text-sm font-semibold mt-3">{label}</p>
      <p className="text-gray-500 text-xs mt-0.5">{sub}</p>
    </Link>
  )
}

function MiniStat({ icon: Icon, label, value, tone }: {
  icon: React.ElementType; label: string; value: number; tone?: 'orange' | 'red' | 'blue'
}) {
  const highlight = tone && value > 0
  const toneText = tone === 'orange' ? 'text-orange-400' : tone === 'red' ? 'text-red-400' : tone === 'blue' ? 'text-blue-400' : 'text-white'
  const toneTile = tone === 'orange' ? 'bg-orange-500/15' : tone === 'red' ? 'bg-red-500/15' : tone === 'blue' ? 'bg-blue-500/15' : 'bg-charcoal-700/70'
  const toneIcon = tone === 'orange' ? 'text-orange-400' : tone === 'red' ? 'text-red-400' : tone === 'blue' ? 'text-blue-400' : 'text-gray-300'
  return (
    <div className="bg-charcoal-800/60 border border-charcoal-700 rounded-2xl px-5 py-4 flex items-center gap-4 transition-colors hover:border-charcoal-600">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${highlight ? toneTile : 'bg-charcoal-700/70'}`}>
        <Icon size={22} className={highlight ? toneIcon : 'text-gray-300'} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className={`font-display text-3xl font-bold leading-none ${highlight ? toneText : 'text-white'}`}>
          <CountUp value={String(value)} />
        </p>
        <p className="text-gray-400 text-xs mt-1.5 leading-snug">{label}</p>
      </div>
    </div>
  )
}

// Single-hue (brand gold) weekly bar chart with a per-bar hover tooltip.
function WeeklyBarChart({ title, data }: { title: string; data: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 30)
    return () => clearTimeout(t)
  }, [])
  const max = Math.max(1, ...data.map(d => d.value))
  const total = data.reduce((s, d) => s + d.value, 0)
  const chartH = 120
  const barW = 18
  const gap = 10
  const chartW = data.length * (barW + gap) - gap

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-white text-sm font-semibold">{title}</p>
        <p className="text-gold-400 font-display text-xl font-bold"><CountUp value={String(total)} /></p>
      </div>
      <div className="relative" style={{ height: chartH + 20 }}>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} preserveAspectRatio="none" className="overflow-visible">
          {/* recessive baseline */}
          <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#2E2E2E" strokeWidth={1} />
          {data.map((point, i) => {
            const h = point.value === 0 ? 0 : Math.max(3, (point.value / max) * (chartH - 8))
            const x = i * (barW + gap)
            const y = chartH - h
            return (
              <g key={i}>
                <rect
                  x={x} y={grown ? y : chartH} width={barW} height={grown ? h : 0} rx={4}
                  fill={hover === i ? '#e0a135' : '#C8861A'}
                  className="transition-[height,y,fill] ease-out cursor-pointer"
                  style={{ transitionDuration: '600ms, 600ms, 200ms', transitionDelay: `${i * 45}ms, ${i * 45}ms, 0ms` }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
                <rect x={x} y={0} width={barW} height={chartH} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div
            className="absolute -top-1 bg-charcoal-900 border border-charcoal-600 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap pointer-events-none shadow-lg"
            style={{ left: `${((hover * (barW + gap) + barW / 2) / chartW) * 100}%`, transform: 'translate(-50%, -100%)' }}
          >
            <p className="text-white font-semibold">{data[hover].value}</p>
            <p className="text-gray-400">{data[hover].label}</p>
          </div>
        )}
        <div className="flex justify-between mt-2 text-[10px] text-gray-500">
          <span>{data[0]?.label}</span>
          <span>{data[data.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  )
}

// Horizontal stacked proportion bar using the fixed status palette (never
// reused for identity), with an icon + label legend so status is never
// carried by color alone.
function StatusBreakdownBar({ approved, pending, rejected }: { approved: number; pending: number; rejected: number }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 30)
    return () => clearTimeout(t)
  }, [])
  const total = Math.max(1, approved + pending + rejected)
  const segments = [
    { key: 'approved', value: approved, color: STATUS.good, icon: CheckCircle, label: 'Approved' },
    { key: 'pending', value: pending, color: STATUS.warning, icon: Clock, label: 'Pending' },
    { key: 'rejected', value: rejected, color: STATUS.critical, icon: XCircle, label: 'Rejected' },
  ]

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5">
      <div className="flex h-6 rounded-full overflow-hidden bg-charcoal-700" style={{ gap: '2px' }}>
        {segments.map((s, i) => s.value > 0 && (
          <div
            key={s.key}
            style={{
              width: grown ? `${(s.value / total) * 100}%` : '0%',
              backgroundColor: s.color,
              transitionDelay: `${i * 120}ms`,
            }}
            className="transition-[width] duration-700 ease-out"
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-5 mt-4">
        {segments.map(s => {
          const Icon = s.icon
          return (
            <div key={s.key} className="flex items-center gap-2">
              <Icon size={15} style={{ color: s.color }} />
              <span className="text-gray-300 text-sm">{s.label}</span>
              <span className="text-white font-semibold text-sm">{s.value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Horizontal bar chart, one bar per event, brand gold hue, direct value labels.
function EventsBarChart({ events }: { events: EventRow[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 30)
    return () => clearTimeout(t)
  }, [])
  const top = events.slice(0, 8)
  const max = Math.max(1, ...top.map(e => e.tickets))

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5 space-y-3">
      {top.map((e, i) => (
        <div
          key={e.id}
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => { window.location.href = `/admin/events?event=${e.id}` }}
        >
          <p className="text-gray-300 text-sm w-40 truncate shrink-0" title={e.title}>{e.title}</p>
          <div
            className="relative flex-1 h-6 rounded-full bg-charcoal-700 overflow-hidden cursor-pointer"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: grown ? `${Math.max(4, (e.tickets / max) * 100)}%` : '0%',
                transitionDelay: `${i * 70}ms`,
                background: hover === i
                  ? 'linear-gradient(to right, #e0a135, #f4d99b)'
                  : 'linear-gradient(to right, #C8861A, #e0a135)',
              }}
            />
          </div>
          <p className="text-gold-400 font-semibold text-sm w-10 text-right shrink-0">{e.tickets}</p>
        </div>
      ))}
      {events.length > 8 && (
        <p className="text-gray-500 text-xs pt-1">Showing the {top.length} most recent of {events.length} events.</p>
      )}
    </div>
  )
}

// Sends this table to the events inbox on demand. The same report goes out on
// its own every morning while an event is inside its four week run-up; this is
// for seeing it now, and for checking it still looks right after a change.
function EmailReportButton() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  async function send() {
    setBusy(true)
    setResult(null)
    setFailed(false)
    try {
      const res = await fetch('/api/cron/event-sales-report?force=1')
      const d = await res.json().catch(() => ({}))
      setFailed(!res.ok || !d.sent)
      setResult(
        res.ok && d.sent
          ? `Sent. ${d.eventsInWindow} event${d.eventsInWindow === 1 ? '' : 's'} in the next four weeks.`
          : d.error || d.reason || 'Could not send the report.',
      )
    } catch {
      setFailed(true)
      setResult('Could not reach the server.')
    }
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {result && (
        <span className={`text-sm ${failed ? 'text-red-400' : 'text-green-400'}`}>{result}</span>
      )}
      <button
        onClick={send}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-gold-400 hover:text-gold-300 disabled:opacity-50 text-sm font-semibold"
        title="Email this table to events@bild.ae now"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {busy ? 'Sending...' : 'Email me this'}
      </button>
    </div>
  )
}
