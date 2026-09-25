import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNav from '@/components/admin/AdminNav'
import { CLICK_KINDS, KIND_LABEL, daysAgoIso, statsForAll, totalClicks, type Totals } from '@/lib/directory-stats'

export const dynamic = 'force-dynamic'

// Directory performance, per listing.
//
// The point of this page is the offer. Sorting standard listings by views
// surfaces the ones already getting traffic without paying for it - those are
// the businesses for whom Featured is an easy yes, because the argument is
// made with their own number rather than a generic claim.
export default async function DirectoryStatsPage() {
  if (!(await verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value))) {
    redirect('/admin/login')
  }

  const since = daysAgoIso(30)
  const [per, { data: businesses }] = await Promise.all([
    statsForAll(since).catch(() => new Map<string, Totals>()),
    supabaseAdmin
      .from('business_submissions')
      .select('id, business_name, slug, featured, featured_paid_until, profile_view_count')
      .eq('status', 'approved')
      .is('delisted_at', null),
  ])

  const nowIso = new Date().toISOString()
  const rows = (businesses || [])
    .map(b => {
      const t = per.get(b.id) || {}
      const isFeatured = !!b.featured && (b.featured_paid_until == null || b.featured_paid_until >= nowIso)
      return {
        ...b,
        isFeatured,
        views: t.view || 0,
        clicks: totalClicks(t),
        t,
      }
    })
    .sort((a, b) => b.views - a.views || b.clicks - a.clicks)

  const featured = rows.filter(r => r.isFeatured)
  const standard = rows.filter(r => !r.isFeatured)
  const avg = (list: typeof rows, key: 'views' | 'clicks') =>
    list.length ? Math.round(list.reduce((n, r) => n + r[key], 0) / list.length) : 0

  // The listings worth approaching: standard, and already getting traffic.
  const prospects = standard.filter(r => r.views > 0).slice(0, 5)

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
          <h1 className="font-display text-2xl font-bold text-white">Directory performance</h1>
          <Link href="/admin/directory" className="text-gold-400 text-sm hover:underline">&larr; Directory</Link>
        </div>
        <p className="text-gray-400 text-sm mb-8">
          Last 30 days. Repeat visits from the same person count once a day and automated traffic is excluded, so
          these are figures you can put in front of a business.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <Stat label="Featured listings" value={featured.length} />
          <Stat label="Avg views, Featured" value={avg(featured, 'views')} />
          <Stat label="Avg views, standard" value={avg(standard, 'views')} />
          <Stat label="Avg enquiries, Featured" value={avg(featured, 'clicks')} />
        </div>

        {prospects.length > 0 && (
          <div className="bg-gold-500/10 border border-gold-500/30 rounded-2xl p-5 mb-8">
            <h2 className="text-gold-300 font-semibold text-sm mb-1">Worth approaching about Featured</h2>
            <p className="text-gray-400 text-xs mb-3">
              Standard listings already getting traffic. The offer writes itself: they can see what they are getting
              for free, and what they are not seeing.
            </p>
            <ul className="space-y-1">
              {prospects.map(p => (
                <li key={p.id} className="text-sm text-gray-200 flex items-center justify-between gap-3">
                  <span className="truncate">{p.business_name}</span>
                  <span className="text-gold-300 tabular-nums shrink-0">{p.views} views</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-charcoal-700">
                <th className="text-left font-medium px-4 py-3">Business</th>
                <th className="text-right font-medium px-3 py-3">Views</th>
                <th className="text-right font-medium px-3 py-3">Enquiries</th>
                {CLICK_KINDS.map(k => (
                  <th key={k} className="text-right font-medium px-3 py-3 whitespace-nowrap">
                    {KIND_LABEL[k].replace(' clicks', '').replace(' visits', '').replace(' taps', '').replace(' started', '').replace(' downloads', '')}
                  </th>
                ))}
                <th className="text-right font-medium px-4 py-3">All time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-charcoal-700/60 last:border-0 hover:bg-charcoal-700/30">
                  <td className="px-4 py-2.5">
                    <a href={`/directory/${r.slug}`} target="_blank" rel="noopener noreferrer" className="text-gray-200 hover:text-gold-400">
                      {r.business_name}
                    </a>
                    {r.isFeatured && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-gold-500/20 text-gold-400 px-1.5 py-0.5 rounded">Feat</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white font-semibold tabular-nums">{r.views}</td>
                  <td className="px-3 py-2.5 text-right text-gold-400 font-semibold tabular-nums">{r.clicks}</td>
                  {CLICK_KINDS.map(k => (
                    <td key={k} className="px-3 py-2.5 text-right text-gray-400 tabular-nums">{r.t[k] || 0}</td>
                  ))}
                  <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{r.profile_view_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-gray-500 text-xs mt-4">
          &ldquo;All time&rdquo; is the legacy counter, which only ever ran for Featured listings and has no dates.
          Everything else starts from when daily tracking went live.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-4">
      <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
      <p className="font-display text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  )
}
