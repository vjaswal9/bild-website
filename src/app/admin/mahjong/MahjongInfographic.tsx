'use client'

import { useMemo } from 'react'
import type { MahjongRow } from '@/lib/mahjong-admin'
import {
  MAHJONG_AREAS, MAHJONG_EXPERIENCE_OPTIONS, MAHJONG_MEMBER_LABELS, MAHJONG_TIMES,
} from '@/lib/mahjong-interest'

type Bar = { label: string; n: number }

const DAYS = 14

// A calendar day in Dubai, so a sign-up at 11pm there is not counted on the
// next day just because the server runs in UTC.
const dubaiDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' })

// Every choice the form offers appears, even with nobody on it yet: an empty
// bar is a finding ("nobody wants Al Furjan"), a missing one is a question.
function count(labels: string[], values: (string | null | undefined)[]): Bar[] {
  const m = new Map(labels.map(l => [l, 0]))
  for (const v of values) if (v) m.set(v, (m.get(v) || 0) + 1)
  return Array.from(m.entries()).map(([label, n]) => ({ label, n }))
}

const byMost = (bars: Bar[]) => [...bars].sort((a, b) => b.n - a.n)

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-charcoal-800 border border-charcoal-700 p-5">
      <h2 className="font-display text-base font-bold text-white">{title}</h2>
      {note && <p className="text-xs text-gray-400 mt-0.5 mb-3">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </section>
  )
}

// One horizontal bar per choice, longest first, each labelled with its count
// and its share of everyone who registered.
function Bars({ bars, total }: { bars: Bar[]; total: number }) {
  const max = Math.max(1, ...bars.map(b => b.n))
  return (
    <ul className="space-y-3">
      {bars.map(b => {
        const pct = total ? Math.round((b.n / total) * 100) : 0
        return (
          <li key={b.label} title={`${b.label}: ${b.n} of ${total} (${pct}%)`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-gray-200 min-w-0">{b.label}</span>
              <span className="shrink-0 tabular-nums text-white font-semibold">
                {b.n} <span className="text-gray-400 font-normal">&middot; {pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-charcoal-700 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-gold-400" style={{ width: `${(b.n / max) * 100}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Stat({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-charcoal-800 border border-charcoal-700 p-5">
      <p className="font-display text-4xl font-bold text-gold-400 tabular-nums leading-none">{value}</p>
      <p className="text-sm font-semibold text-white mt-2">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function MahjongInfographic({ rows }: { rows: MahjongRow[] }) {
  const total = rows.length

  const d = useMemo(() => {
    const areas = byMost(count([...MAHJONG_AREAS], rows.map(r => r.area)))
    const experience = byMost(count(
      MAHJONG_EXPERIENCE_OPTIONS.map(o => o.label),
      rows.map(r => MAHJONG_EXPERIENCE_OPTIONS.find(o => o.value === r.experience)?.label),
    ))
    const times = byMost(count([...MAHJONG_TIMES], rows.flatMap(r => r.availability || [])))
    // Anyone who answered "Not sure" before it was removed still counts.
    const member = byMost(count(
      MAHJONG_MEMBER_LABELS.filter(o => o.value !== 'unsure' || rows.some(r => r.member_status === 'unsure')).map(o => o.label),
      rows.map(r => MAHJONG_MEMBER_LABELS.find(o => o.value === r.member_status)?.label),
    ))

    const today = new Date()
    const days = Array.from({ length: DAYS }, (_, i) => {
      const dt = new Date(today.getTime() - (DAYS - 1 - i) * 86400000)
      return { key: dubaiDay(dt), dt, n: 0 }
    })
    for (const r of rows) {
      const hit = days.find(x => x.key === dubaiDay(new Date(r.created_at)))
      if (hit) hit.n += 1
    }

    const learners = rows.filter(r => r.experience === 'beginner' || r.experience === 'refresher').length
    const members = rows.filter(r => r.member_status === 'yes').length
    return { areas, experience, times, member, days, learners, members }
  }, [rows])

  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : '0%')
  const topArea = d.areas[0]?.n ? d.areas[0] : null
  const topTime = d.times[0]?.n ? d.times[0] : null
  const dayMax = Math.max(1, ...d.days.map(x => x.n))
  const lastTwoWeeks = d.days.reduce((s, x) => s + x.n, 0)

  if (total === 0) return null

  return (
    <div className="space-y-4 mb-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat value={total} label={total === 1 ? 'person registered' : 'people registered'} sub={`${lastTwoWeeks} in the last ${DAYS} days`} />
        <Stat value={pct(d.learners)} label="want to learn or refresh" sub={`${d.learners} of ${total} are beginners or rusty`} />
        <Stat value={pct(d.members)} label="are BILD members" sub={`${d.members} of ${total}; the rest want to join`} />
        <Stat value={topArea ? topArea.n : 0} label={topArea ? 'in the top area' : 'in the top area'} sub={topArea ? topArea.label : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Where they live" note="Preferred area, most popular first">
          <Bars bars={d.areas} total={total} />
        </Panel>

        <div className="space-y-4">
          <Panel title="Experience">
            <Bars bars={d.experience} total={total} />
          </Panel>
          <Panel title="BILD members">
            <Bars bars={d.member} total={total} />
          </Panel>
        </div>

        <Panel title="When they could join" note={topTime ? `Choose-all-that-suit, so shares add up to more than 100%. Best: ${topTime.label.toLowerCase()}.` : 'Choose-all-that-suit'}>
          <Bars bars={d.times} total={total} />
        </Panel>

        <Panel title={`Sign-ups, last ${DAYS} days`} note="Registrations per day (Dubai time)">
          <div className="flex items-end gap-1.5 h-32" role="img" aria-label={`Sign-ups per day for the last ${DAYS} days: ${d.days.map(x => x.n).join(', ')}`}>
            {d.days.map(x => (
              <div key={x.key} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1" title={`${x.dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })}: ${x.n}`}>
                <span className="text-[10px] tabular-nums text-gray-300 h-3 leading-3">{x.n > 0 ? x.n : ''}</span>
                <div className={`w-full rounded-t ${x.n ? 'bg-gold-400' : 'bg-charcoal-700'}`} style={{ height: `${x.n ? Math.max(6, (x.n / dayMax) * 88) : 2}px` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-gray-400 tabular-nums">
            <span>{d.days[0].dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })}</span>
            <span>Today</span>
          </div>
        </Panel>
      </div>
    </div>
  )
}
