'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Wallet, Receipt, PiggyBank, Percent, Plus, Trash2,
  Loader2, RefreshCw, Ticket, Store, Star, Users, ArrowRight, Info, Clock, Handshake, Lock,
} from 'lucide-react'
import { YearSummary, formatAed, COST_CATEGORIES } from '@/lib/money'

type CostLine = {
  id: string
  incurredOn: string
  category: string
  description: string
  amountAed: number
  eventTitle: string | null
}

type IncomeLine = {
  id: string
  paidOn: string
  kind: string
  description: string
  amountAed: number
  eventTitle: string | null
}

type Props = {
  summary: YearSummary
  previous: { revenue: number; totalCosts: number; profit: number } | null
  years: number[]
  costLines: CostLine[]
  events: { id: string; title: string; date: string }[]
  hasLedger: boolean
  lastImportAt: string | null
  incomeLines: IncomeLine[]
}

// Dubai time, because that is where the admin reading this actually is.
function formatImportedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dubai',
  })
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
  })
  return `${date} at ${time}`
}

// The palette is fixed per revenue stream so a colour means the same thing in
// the donut, the legend and the per-stream cards.
const STREAM_COLOURS: Record<string, string> = {
  membership: '#c8a04a',
  event_ticket: '#4a90d9',
  listing: '#4aa96c',
  featured: '#b06ad9',
  sponsorship: '#d98a4a',
  other: '#8a8a8a',
}

const STREAM_ICONS: Record<string, typeof Users> = {
  membership: Users,
  event_ticket: Ticket,
  listing: Store,
  featured: Star,
  sponsorship: Handshake,
  other: Wallet,
}

export default function MoneyClient({ summary, previous, years, costLines, events, hasLedger, lastImportAt, incomeLines }: Props) {
  const router = useRouter()
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  // Shown immediately after a run, so the date updates without waiting for
  // the server component to refetch.
  const [importedAt, setImportedAt] = useState<string | null>(lastImportAt)

  async function runImport() {
    setImporting(true)
    setImportMsg('')
    try {
      const res = await fetch('/api/admin/money/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromYear: Math.min(...years, new Date().getFullYear()) - 1 }),
      })
      const d = await res.json()
      if (!res.ok) {
        setImportMsg(d.error || 'Import failed.')
      } else {
        setImportMsg(
          `Imported ${d.inserted} new payment${d.inserted === 1 ? '' : 's'} from ${d.paidSessions} Stripe checkouts. ` +
          `${d.alreadyRecorded} were already recorded.`,
        )
        if (d.importedAt) setImportedAt(d.importedAt)
        router.refresh()
      }
    } catch {
      setImportMsg('Import failed. Please try again.')
    }
    setImporting(false)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

      {/* Year selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Money</h1>
          <p className="text-gray-400 text-sm mt-1">
            Revenue, costs and profit across memberships, events and the Business Directory.
          </p>
          <button
            onClick={async () => {
              await fetch('/api/admin/money/unlock', { method: 'DELETE' })
              router.refresh()
            }}
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gold-400 text-xs mt-2 transition-colors"
            title="Lock the Money section now"
          >
            <Lock size={12} /> Unlocked. Locks itself after 30 minutes, or lock it now
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {years.map(y => (
            <button
              key={y}
              onClick={() => router.push(`/admin/money?year=${y}`)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                y === summary.year
                  ? 'bg-gold-500 text-white'
                  : 'bg-charcoal-800 text-gray-400 hover:text-white hover:bg-charcoal-700'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {!hasLedger && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5 mb-8">
          <p className="text-blue-200 font-semibold text-sm mb-1">No payments recorded yet</p>
          <p className="text-blue-200/70 text-sm leading-relaxed">
            New payments are recorded automatically from now on. To see this year&rsquo;s history, run the Stripe
            import below. It reads Stripe&rsquo;s own record of every payment taken, including directory listings and
            Featured placements, which were never stored anywhere before.
          </p>
        </div>
      )}

      {/* ---- Headline figures ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi
          icon={Wallet}
          label="Total revenue"
          value={summary.revenue}
          previous={previous?.revenue}
          tone="gold"
          sub={`${summary.transactions} payment${summary.transactions === 1 ? '' : 's'}`}
        />
        <Kpi
          icon={Receipt}
          label="Total costs"
          value={summary.totalCosts}
          previous={previous?.totalCosts}
          tone="red"
          invertTrend
          sub="Stripe, events and operating"
        />
        <Kpi
          icon={PiggyBank}
          label="Net profit"
          value={summary.profit}
          previous={previous?.profit}
          tone={summary.profit >= 0 ? 'green' : 'red'}
          sub={summary.profit >= 0 ? 'after all costs' : 'loss for the year'}
        />
        <Kpi
          icon={Percent}
          label="Profit margin"
          value={summary.margin}
          tone="blue"
          suffix="%"
          decimals={1}
          sub="profit as a share of revenue"
        />
      </div>

      {/* ---- Where the money goes ---- */}
      <Card title="Where the money goes" subtitle={`Every dirham collected in ${summary.year}`}>
        <Flow summary={summary} />
      </Card>

      {/* ---- Monthly chart ---- */}
      <Card
        title="Revenue, costs and profit by month"
        subtitle="Bars are revenue and costs. The line is profit."
      >
        <MonthlyChart summary={summary} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ---- Revenue by stream ---- */}
        <Card title="Revenue by stream" subtitle="Which part of BILD earned it">
          {summary.byStream.length === 0 ? (
            <Empty>No revenue recorded for {summary.year}.</Empty>
          ) : (
            <Donut summary={summary} />
          )}
        </Card>

        {/* ---- Cost breakdown ---- */}
        <Card title="Cost breakdown" subtitle="What BILD spent, largest first">
          {summary.costBreakdown.length === 0 ? (
            <Empty>No costs recorded for {summary.year}.</Empty>
          ) : (
            <CostBars summary={summary} />
          )}
        </Card>
      </div>

      {/* ---- Stripe explainer ---- */}
      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-gold-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400 leading-relaxed">
            <p className="text-white font-semibold mb-1">How Stripe fees are treated</p>
            <p>
              Stripe took <strong className="text-white">{formatAed(summary.stripeFeeTotal, 2)} AED</strong> in fees
              this year. Event ticket buyers were surcharged{' '}
              <strong className="text-white">{formatAed(summary.feePassedOn, 2)} AED</strong> of that at checkout, so
              it costs BILD nothing. The remaining{' '}
              <strong className="text-gold-400">{formatAed(summary.netStripeCost, 2)} AED</strong> comes out of
              BILD&rsquo;s own pocket, and that is the only Stripe figure counted as a cost above. It is mostly the
              fee on 50 AED memberships and on directory fees, neither of which carries a surcharge.
            </p>
          </div>
        </div>
      </div>

      {/* ---- Per event ---- */}
      <Card title="Profit by event" subtitle="Ticket revenue less ticket cost prices, attributed costs and Stripe fees">
        {summary.byEvent.length === 0 ? (
          <Empty>No event ticket sales recorded for {summary.year}.</Empty>
        ) : (
          <EventTable summary={summary} />
        )}
      </Card>

      {/* ---- Income taken outside Stripe ---- */}
      <Card
        title="Income recorded outside Stripe"
        subtitle="Cash, bank transfers, sponsorships, and any year that predates the website"
      >
        <IncomeEditor year={summary.year} incomeLines={incomeLines} events={events} />
      </Card>

      {/* ---- Operating costs ---- */}
      <Card
        title="Operating costs"
        subtitle="Venue, licence, software and anything else Stripe and ticket cost prices do not already capture"
      >
        <CostEditor year={summary.year} costLines={costLines} events={events} />
      </Card>

      {/* ---- Import ---- */}
      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-xl">
            <p className="text-white font-semibold text-sm mb-1">Import history from Stripe</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Reads every payment Stripe has taken and fills any gaps in the ledger, using the real fee Stripe
              charged on each one. Safe to run as often as you like. Payments already recorded are left alone.
            </p>
            {importMsg && <p className="text-gold-400 text-sm mt-3">{importMsg}</p>}
          </div>
          <div className="shrink-0 text-right">
            <button
              onClick={runImport}
              disabled={importing}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {importing ? 'Importing...' : 'Import from Stripe'}
            </button>
            <p className="inline-flex items-center gap-1.5 text-gray-500 text-xs mt-2 w-full justify-end">
              <Clock size={12} />
              {importedAt ? `Last imported ${formatImportedAt(importedAt)}` : 'Never imported'}
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5 sm:p-6 mb-6">
      <h2 className="text-white font-semibold">{title}</h2>
      {subtitle && <p className="text-gray-500 text-xs mt-0.5 mb-5">{subtitle}</p>}
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-500 text-sm py-8 text-center">{children}</p>
}

const TONES: Record<string, { bg: string; text: string }> = {
  gold: { bg: 'bg-gold-500/15', text: 'text-gold-400' },
  green: { bg: 'bg-green-500/15', text: 'text-green-400' },
  red: { bg: 'bg-red-500/15', text: 'text-red-400' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
}

function Kpi({
  icon: Icon, label, value, previous, tone, sub, suffix = ' AED', decimals = 0, invertTrend = false,
}: {
  icon: typeof Wallet
  label: string
  value: number
  previous?: number
  tone: keyof typeof TONES
  sub?: string
  suffix?: string
  decimals?: number
  invertTrend?: boolean
}) {
  const t = TONES[tone]
  const change = previous != null && previous !== 0 ? ((value - previous) / Math.abs(previous)) * 100 : null
  // On costs, going up is bad, so the colour is inverted rather than the arrow.
  const good = change == null ? true : invertTrend ? change <= 0 : change >= 0

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-lg ${t.bg} flex items-center justify-center mb-3`}>
        <Icon size={18} className={t.text} />
      </div>
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`font-display text-2xl sm:text-3xl font-bold ${t.text} mt-1 leading-none`}>
        {formatAed(value, decimals)}
        <span className="text-sm font-semibold ml-1">{suffix.trim()}</span>
      </p>
      {change != null && (
        <p className={`inline-flex items-center gap-1 text-xs mt-2 ${good ? 'text-green-400' : 'text-red-400'}`}>
          {change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(change).toFixed(0)}% vs last year
        </p>
      )}
      {change == null && sub && <p className="text-gray-500 text-xs mt-2">{sub}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Infographic: gross collected -> revenue -> profit                   */
/* ------------------------------------------------------------------ */

function Flow({ summary }: { summary: YearSummary }) {
  const steps = [
    { label: 'Collected from customers', value: summary.grossCollected, tone: 'text-white', note: 'everything charged through Stripe' },
    { label: 'Card fees passed on', value: -summary.feePassedOn, tone: 'text-gray-400', note: 'surcharge collected for Stripe, not income' },
    { label: 'BILD revenue', value: summary.revenue, tone: 'text-gold-400', note: 'what BILD actually earned' },
    { label: 'Total costs', value: -summary.totalCosts, tone: 'text-red-400', note: 'Stripe, event costs and operating costs' },
    { label: 'Net profit', value: summary.profit, tone: summary.profit >= 0 ? 'text-green-400' : 'text-red-400', note: 'what is left' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {steps.map((s, i) => (
        <div key={s.label} className="relative">
          <div className="bg-charcoal-900 border border-charcoal-700 rounded-xl p-4 h-full">
            <p className="text-gray-500 text-[11px] uppercase tracking-wide font-medium leading-tight">{s.label}</p>
            <p className={`font-display text-xl font-bold mt-2 leading-none ${s.tone}`}>
              {s.value < 0 ? '-' : ''}{formatAed(Math.abs(s.value))}
              <span className="text-xs ml-1">AED</span>
            </p>
            <p className="text-gray-600 text-[11px] mt-2 leading-snug">{s.note}</p>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight
              size={16}
              className="hidden lg:block absolute top-1/2 -right-2.5 -translate-y-1/2 text-charcoal-600 z-10"
            />
          )}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Monthly grouped bars + profit line                                  */
/* ------------------------------------------------------------------ */

function MonthlyChart({ summary }: { summary: YearSummary }) {
  const W = 760, H = 300
  const padL = 56, padR = 12, padT = 16, padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const max = Math.max(
    1,
    ...summary.byMonth.map(m => Math.max(m.revenue, m.costs, Math.abs(m.profit))),
  )
  // Round the axis up to something readable rather than to the exact max.
  const step = Math.pow(10, Math.floor(Math.log10(max)))
  const top = Math.ceil(max / step) * step
  const y = (v: number) => padT + plotH - (v / top) * plotH
  const bandW = plotW / 12
  const barW = Math.min(14, bandW / 3.2)

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => f * top)
  const linePoints = summary.byMonth
    .map((m, i) => `${padL + bandW * i + bandW / 2},${y(Math.max(0, m.profit))}`)
    .join(' ')

  const hasData = summary.byMonth.some(m => m.revenue !== 0 || m.costs !== 0)
  if (!hasData) return <Empty>No payments recorded for {summary.year}.</Empty>

  return (
    <>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto min-w-[560px]" role="img" aria-label="Monthly revenue, costs and profit">
          {gridLines.map(g => (
            <g key={g}>
              <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#3a3a3a" strokeWidth="1" />
              <text x={padL - 8} y={y(g) + 4} textAnchor="end" fontSize="10" fill="#8a8a8a">
                {g >= 1000 ? `${Math.round(g / 1000)}k` : Math.round(g)}
              </text>
            </g>
          ))}

          {summary.byMonth.map((m, i) => {
            const cx = padL + bandW * i + bandW / 2
            return (
              <g key={m.month}>
                <rect
                  x={cx - barW - 2} y={y(m.revenue)} width={barW} height={Math.max(0, y(0) - y(m.revenue))}
                  fill="#c8a04a" rx="2"
                >
                  <title>{`${m.month}: ${formatAed(m.revenue)} AED revenue`}</title>
                </rect>
                <rect
                  x={cx + 2} y={y(m.costs)} width={barW} height={Math.max(0, y(0) - y(m.costs))}
                  fill="#a04a4a" rx="2"
                >
                  <title>{`${m.month}: ${formatAed(m.costs)} AED costs`}</title>
                </rect>
                <text x={cx} y={H - 12} textAnchor="middle" fontSize="10" fill="#8a8a8a">{m.month}</text>
              </g>
            )
          })}

          <polyline points={linePoints} fill="none" stroke="#4aa96c" strokeWidth="2" strokeLinejoin="round" />
          {summary.byMonth.map((m, i) => (
            <circle key={m.month} cx={padL + bandW * i + bandW / 2} cy={y(Math.max(0, m.profit))} r="3" fill="#4aa96c">
              <title>{`${m.month}: ${formatAed(m.profit)} AED profit`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="flex items-center gap-5 mt-4 text-xs text-gray-400 flex-wrap">
        <Swatch colour="#c8a04a" label="Revenue" />
        <Swatch colour="#a04a4a" label="Costs" />
        <Swatch colour="#4aa96c" label="Profit" />
      </div>
    </>
  )
}

function Swatch({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-3 h-3 rounded-sm" style={{ background: colour }} />
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Revenue donut                                                       */
/* ------------------------------------------------------------------ */

function Donut({ summary }: { summary: YearSummary }) {
  const streams = summary.byStream.filter(s => s.revenue > 0)
  const total = streams.reduce((s, x) => s + x.revenue, 0)
  const R = 60, C = 2 * Math.PI * R

  let offset = 0
  const segments = streams.map(s => {
    const frac = total > 0 ? s.revenue / total : 0
    const seg = { ...s, frac, dash: frac * C, offset }
    offset += frac * C
    return seg
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0 -rotate-90" role="img" aria-label="Revenue by stream">
        <circle cx="80" cy="80" r={R} fill="none" stroke="#2a2a2a" strokeWidth="24" />
        {segments.map(s => (
          <circle
            key={s.kind}
            cx="80" cy="80" r={R} fill="none"
            stroke={STREAM_COLOURS[s.kind]}
            strokeWidth="24"
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={-s.offset}
          >
            <title>{`${s.label}: ${formatAed(s.revenue)} AED`}</title>
          </circle>
        ))}
      </svg>

      <div className="flex-1 w-full space-y-3">
        {segments.map(s => {
          const Icon = STREAM_ICONS[s.kind] || Wallet
          return (
            <div key={s.kind} className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${STREAM_COLOURS[s.kind]}22` }}
              >
                <Icon size={15} style={{ color: STREAM_COLOURS[s.kind] }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{s.label}</p>
                <p className="text-gray-500 text-xs">{s.count} payment{s.count === 1 ? '' : 's'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white text-sm font-semibold">{formatAed(s.revenue)} AED</p>
                <p className="text-gray-500 text-xs">{(s.frac * 100).toFixed(0)}%</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cost breakdown bars                                                 */
/* ------------------------------------------------------------------ */

function CostBars({ summary }: { summary: YearSummary }) {
  const rows = [...summary.costBreakdown].sort((a, b) => b.amount - a.amount)
  const max = Math.max(1, ...rows.map(r => r.amount))

  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-gray-300 text-sm truncate">{r.label}</span>
            <span className="text-white text-sm font-semibold shrink-0">{formatAed(r.amount, 2)} AED</span>
          </div>
          <div className="h-2.5 bg-charcoal-900 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500/70 to-red-400"
              style={{ width: `${(r.amount / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 pt-3 mt-3 border-t border-charcoal-700">
        <span className="text-gray-400 text-sm font-medium">Total costs</span>
        <span className="text-red-400 font-display text-lg font-bold">{formatAed(summary.totalCosts, 2)} AED</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Per-event table                                                     */
/* ------------------------------------------------------------------ */

function EventTable({ summary }: { summary: YearSummary }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide">
            <th className="text-left font-medium pb-3">Event</th>
            <th className="text-right font-medium pb-3">Tickets</th>
            <th className="text-right font-medium pb-3">Revenue</th>
            <th className="text-right font-medium pb-3">Costs</th>
            <th className="text-right font-medium pb-3">Profit</th>
          </tr>
        </thead>
        <tbody>
          {summary.byEvent.map(e => (
            <tr key={e.id} className="border-t border-charcoal-700">
              <td className="py-3 pr-4">
                <p className="text-white font-medium">{e.title}</p>
                <p className="text-gray-500 text-xs">
                  {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </td>
              <td className="py-3 text-right text-gray-300">{e.tickets}</td>
              <td className="py-3 text-right text-gray-300">{formatAed(e.revenue)}</td>
              <td className="py-3 text-right text-gray-300">{formatAed(e.costs)}</td>
              <td className={`py-3 text-right font-semibold ${e.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatAed(e.profit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-gray-600 text-xs mt-4 leading-relaxed">
        Costs here are the cost price set on each ticket type, plus any operating cost you attributed to the event,
        plus the share of Stripe fees BILD did not recover. Set a ticket cost price on the Events page to make these
        figures complete.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Operating cost entry                                                */
/* ------------------------------------------------------------------ */

function CostEditor({
  year, costLines, events,
}: {
  year: number
  costLines: CostLine[]
  events: { id: string; title: string; date: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const defaultDate = year === new Date().getFullYear() ? today : `${year}-01-01`

  const [form, setForm] = useState({
    incurredOn: defaultDate,
    category: 'Other' as string,
    description: '',
    amountAed: '',
    eventId: '',
  })

  const total = useMemo(() => costLines.reduce((s, c) => s + c.amountAed, 0), [costLines])

  async function save() {
    setError('')
    setSaving(true)
    const res = await fetch('/api/admin/money/costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amountAed: parseFloat(form.amountAed) }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(d.error || 'Could not save.')
      return
    }
    setForm({ incurredOn: defaultDate, category: 'Other', description: '', amountAed: '', eventId: '' })
    setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this cost?')) return
    setDeleting(id)
    await fetch(`/api/admin/money/costs?id=${id}`, { method: 'DELETE' })
    setDeleting(null)
    router.refresh()
  }

  const input = 'w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500'

  return (
    <>
      {costLines.length === 0 ? (
        <Empty>No operating costs recorded for {year}.</Empty>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left font-medium pb-3">Date</th>
                <th className="text-left font-medium pb-3">Category</th>
                <th className="text-left font-medium pb-3">Description</th>
                <th className="text-right font-medium pb-3">Amount</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {costLines.map(c => (
                <tr key={c.id} className="border-t border-charcoal-700">
                  <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">
                    {new Date(c.incurredOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="py-3 pr-4 text-gray-300">{c.category}</td>
                  <td className="py-3 pr-4 text-white">
                    {c.description}
                    {c.eventTitle && <span className="text-gray-500 text-xs block">{c.eventTitle}</span>}
                  </td>
                  <td className="py-3 text-right text-white font-medium whitespace-nowrap">
                    {formatAed(c.amountAed, 2)} AED
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      onClick={() => remove(c.id)}
                      disabled={deleting === c.id}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="Delete cost"
                    >
                      {deleting === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-charcoal-600">
                <td colSpan={3} className="py-3 text-gray-400 font-medium">Total</td>
                <td className="py-3 text-right text-white font-display font-bold">{formatAed(total, 2)} AED</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div className="bg-charcoal-900 border border-charcoal-600 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Date</span>
              <input type="date" value={form.incurredOn} onChange={e => setForm({ ...form, incurredOn: e.target.value })} className={input} />
            </label>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Category</span>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={input}>
                {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Amount (AED)</span>
              <input
                type="number" min="0" step="0.01" value={form.amountAed}
                onChange={e => setForm({ ...form, amountAed: e.target.value })}
                placeholder="0.00" className={input}
              />
            </label>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Event (optional)</span>
              <select value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className={input}>
                <option value="">Not event specific</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </label>
          </div>
          <label className="block mb-3">
            <span className="text-gray-400 text-xs block mb-1">Description</span>
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Trade licence renewal" className={input}
            />
          </label>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Save cost
            </button>
            <button
              onClick={() => { setOpen(false); setError('') }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Add a cost
        </button>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Income taken outside Stripe                                         */
/* ------------------------------------------------------------------ */

const INCOME_KINDS: { value: string; label: string }[] = [
  { value: 'membership', label: 'Memberships' },
  { value: 'event_ticket', label: 'Event tickets' },
  { value: 'listing', label: 'Directory listings' },
  { value: 'featured', label: 'Featured placements' },
  { value: 'sponsorship', label: 'Sponsorships' },
  { value: 'other', label: 'Other income' },
]

function IncomeEditor({
  year, incomeLines, events,
}: {
  year: number
  incomeLines: IncomeLine[]
  events: { id: string; title: string; date: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  // A past year opens on 1 January of that year rather than today, which
  // would be rejected as belonging to a different year.
  const defaultDate = year === new Date().getFullYear() ? today : `${year}-01-01`

  const [form, setForm] = useState({
    paidOn: defaultDate,
    kind: 'other',
    description: '',
    amountAed: '',
    eventId: '',
  })

  const total = useMemo(() => incomeLines.reduce((s, c) => s + c.amountAed, 0), [incomeLines])

  async function save() {
    setError('')
    if (new Date(form.paidOn).getFullYear() !== year) {
      setError(`That date is not in ${year}. Switch year at the top, or change the date.`)
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/money/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amountAed: parseFloat(form.amountAed) }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(d.error || 'Could not save.')
      return
    }
    setForm({ paidOn: defaultDate, kind: 'other', description: '', amountAed: '', eventId: '' })
    setOpen(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this income entry?')) return
    setDeleting(id)
    await fetch(`/api/admin/money/income?id=${id}`, { method: 'DELETE' })
    setDeleting(null)
    router.refresh()
  }

  const input = 'w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500'
  const kindLabel = (k: string) => INCOME_KINDS.find(x => x.value === k)?.label ?? k

  return (
    <>
      {incomeLines.length === 0 ? (
        <Empty>No income recorded outside Stripe for {year}.</Empty>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left font-medium pb-3">Date</th>
                <th className="text-left font-medium pb-3">Stream</th>
                <th className="text-left font-medium pb-3">Description</th>
                <th className="text-right font-medium pb-3">Amount</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {incomeLines.map(c => (
                <tr key={c.id} className="border-t border-charcoal-700">
                  <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">
                    {new Date(c.paidOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="py-3 pr-4 text-gray-300">{kindLabel(c.kind)}</td>
                  <td className="py-3 pr-4 text-white">
                    {c.description}
                    {c.eventTitle && <span className="text-gray-500 text-xs block">{c.eventTitle}</span>}
                  </td>
                  <td className="py-3 text-right text-white font-medium whitespace-nowrap">
                    {formatAed(c.amountAed, 2)} AED
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      onClick={() => remove(c.id)}
                      disabled={deleting === c.id}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="Delete income entry"
                    >
                      {deleting === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-charcoal-600">
                <td colSpan={3} className="py-3 text-gray-400 font-medium">Total</td>
                <td className="py-3 text-right text-white font-display font-bold">{formatAed(total, 2)} AED</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div className="bg-charcoal-900 border border-charcoal-600 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Date received</span>
              <input type="date" value={form.paidOn} onChange={e => setForm({ ...form, paidOn: e.target.value })} className={input} />
            </label>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Revenue stream</span>
              <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={input}>
                {INCOME_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Amount (AED)</span>
              <input
                type="number" min="0" step="0.01" value={form.amountAed}
                onChange={e => setForm({ ...form, amountAed: e.target.value })}
                placeholder="0.00" className={input}
              />
            </label>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Event (optional)</span>
              <select value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className={input}>
                <option value="">Not event specific</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </label>
          </div>
          <label className="block mb-3">
            <span className="text-gray-400 text-xs block mb-1">Description</span>
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Diwali 2025 ticket money collected by bank transfer" className={input}
            />
          </label>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Save income
            </button>
            <button
              onClick={() => { setOpen(false); setError('') }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Add income
        </button>
      )}

      <p className="text-gray-600 text-xs mt-4 leading-relaxed">
        These entries count towards revenue and profit exactly like a Stripe payment, but carry no card fee. The
        Stripe import never touches them, so running it again will not duplicate or remove anything you enter here.
      </p>
    </>
  )
}
