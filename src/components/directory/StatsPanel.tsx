import { Eye, TrendingUp, TrendingDown, Minus, Lock } from 'lucide-react'
import { CLICK_KINDS, KIND_LABEL, totalClicks, type Totals } from '@/lib/directory-stats'

// What a listing sees about its own performance.
//
// Two versions of the same data, on purpose. A standard listing is counted in
// full but only shown its view total, with the click breakdown named and
// locked - that is the upgrade argument, made with the business's own numbers
// rather than a generic claim. A Featured listing sees everything.

function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0 && now === 0) return null
  if (before === 0) {
    return <span className="text-xs font-semibold text-emerald-600 inline-flex items-center gap-0.5"><TrendingUp size={12} /> new</span>
  }
  const pct = Math.round(((now - before) / before) * 100)
  if (pct === 0) {
    return <span className="text-xs font-medium text-charcoal-400 inline-flex items-center gap-0.5"><Minus size={12} /> level</span>
  }
  const up = pct > 0
  return (
    <span className={`text-xs font-semibold inline-flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-charcoal-400'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{pct}%
    </span>
  )
}

// A bar chart of the last 30 days. Deliberately not a charting library: this is
// 30 divs, and pulling in a dependency for it would cost more than the feature.
function Sparkline({ daily }: { daily: { day: string; count: number }[] }) {
  const peak = Math.max(1, ...daily.map(d => d.count))
  const total = daily.reduce((n, d) => n + d.count, 0)
  return (
    <>
      {/* Each day gets a visible empty track. Without it a quiet month renders
          as a blank gap under a heading, which reads as broken rather than as
          "not much happened". */}
      <div className="flex items-end gap-[3px] h-14 rounded-md bg-cream px-1.5 py-1" aria-hidden="true">
        {daily.map(d => (
          <div key={d.day} className="flex-1 h-full flex items-end" title={`${d.day}: ${d.count}`}>
            <div
              className={`w-full rounded-sm ${d.count > 0 ? 'bg-gold-400' : 'bg-gold-100'}`}
              style={{ height: d.count > 0 ? `${Math.max(8, (d.count / peak) * 100)}%` : '3px' }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-charcoal-400 mt-1">
        <span>30 days ago</span>
        <span>{total} view{total === 1 ? '' : 's'} in total</span>
        <span>today</span>
      </div>
    </>
  )
}

export default function StatsPanel({
  isFeatured, last30, prev30, allTime, daily,
}: {
  isFeatured: boolean
  last30: Totals
  prev30: Totals
  allTime: Totals
  daily: { day: string; count: number }[]
}) {
  const views = last30.view || 0
  const clicks = totalClicks(last30)
  const hasAnything = (allTime.view || 0) > 0

  return (
    <div className="bg-white border border-gold-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="font-display text-xl font-bold text-charcoal-800">Your listing&rsquo;s performance</h2>
        {isFeatured && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-gold-100 text-gold-700 px-2.5 py-1 rounded-full">Featured</span>
        )}
      </div>
      <p className="text-sm text-charcoal-500 mb-6">
        The last 30 days, compared with the 30 before it. Repeat visits from the same person count once a day, and
        automated traffic is excluded.
      </p>

      {!hasAnything ? (
        <p className="text-sm text-charcoal-500 bg-cream border border-gold-100 rounded-xl px-4 py-3">
          Nothing recorded yet. Figures start appearing within a day of your listing going live.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-cream border border-gold-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-charcoal-500 text-xs font-medium uppercase tracking-wide mb-1">
                <Eye size={13} /> Profile views
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold text-charcoal-800">{views}</span>
                <Delta now={views} before={prev30.view || 0} />
              </div>
              <p className="text-charcoal-400 text-xs mt-1">{allTime.view || 0} all time</p>
            </div>

            <div className={`rounded-xl p-4 border ${isFeatured ? 'bg-cream border-gold-100' : 'bg-charcoal-50 border-charcoal-200'}`}>
              <div className="flex items-center gap-1.5 text-charcoal-500 text-xs font-medium uppercase tracking-wide mb-1">
                {isFeatured ? <TrendingUp size={13} /> : <Lock size={13} />} Enquiries
              </div>
              {isFeatured ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-charcoal-800">{clicks}</span>
                    <Delta now={clicks} before={totalClicks(prev30)} />
                  </div>
                  <p className="text-charcoal-400 text-xs mt-1">people who tapped through to you</p>
                </>
              ) : (
                <>
                  <div className="font-display text-3xl font-bold text-charcoal-300">&mdash;</div>
                  <p className="text-charcoal-400 text-xs mt-1">Featured listings only</p>
                </>
              )}
            </div>
          </div>

          <p className="text-charcoal-500 text-xs font-medium uppercase tracking-wide mb-2">Views, last 30 days</p>
          <Sparkline daily={daily} />

          <div className="mt-6">
            <p className="text-charcoal-500 text-xs font-medium uppercase tracking-wide mb-2">Where people went next</p>
            {isFeatured ? (
              <ul className="divide-y divide-gold-100 border-y border-gold-100">
                {CLICK_KINDS.map(k => (
                  <li key={k} className="flex items-center justify-between py-2">
                    <span className="text-sm text-charcoal-600">{KIND_LABEL[k]}</span>
                    <span className="text-sm font-semibold text-charcoal-800 tabular-nums">{last30[k] || 0}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="relative rounded-xl border border-charcoal-200 overflow-hidden">
                <ul className="divide-y divide-charcoal-100 blur-[3px] select-none" aria-hidden="true">
                  {CLICK_KINDS.map(k => (
                    <li key={k} className="flex items-center justify-between px-4 py-2">
                      <span className="text-sm text-charcoal-500">{KIND_LABEL[k]}</span>
                      <span className="text-sm font-semibold text-charcoal-400">&mdash;</span>
                    </li>
                  ))}
                </ul>
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center px-6">
                  <p className="text-center text-sm text-charcoal-600 max-w-xs">
                    <Lock size={15} className="inline mb-0.5 mr-1 text-gold-600" />
                    Featured listings see who tapped through to their website, phone, WhatsApp and Instagram &mdash;
                    and how that changes month to month.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
