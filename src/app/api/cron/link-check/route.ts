import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendBrokenLinkAdminAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Weekly check that every live directory listing still points at a website
// that answers.
//
// Triggered by Vercel Cron (Authorization: Bearer CRON_SECRET) or manually
// with the x-cron-secret header.
//
// Two deliberate choices. A listing is only flagged after two consecutive
// failed weeks, because a single bad check is usually a host restarting
// rather than a dead site. And nothing is ever unpublished automatically: a
// broken link is surfaced for a human to judge, not acted on by a cron.

const TIMEOUT_MS = 15000
const CONCURRENCY = 6

// The status that counts as alive. Anything under 400 is fine, including
// redirects. 403 and 405 are treated as alive too: plenty of sites block an
// unfamiliar user agent or refuse HEAD while working perfectly in a browser.
const ALIVE_EXTRA = new Set([403, 405, 999])

type Row = { id: string; business_name: string; slug: string | null; website: string | null; website_fail_count: number | null }

type Result = { id: string; name: string; url: string; ok: boolean; status: number; error: string | null }

function describe(status: number, err?: unknown): string | null {
  if (status > 0) return `HTTP ${status}`
  const msg = err instanceof Error ? err.message : String(err ?? '')
  if (/abort|timeout/i.test(msg)) return 'Timed out'
  if (/ENOTFOUND|getaddrinfo|dns/i.test(msg)) return 'Domain not found'
  if (/ECONNREFUSED|refused/i.test(msg)) return 'Connection refused'
  if (/certificate|SSL|TLS/i.test(msg)) return 'Security certificate problem'
  return 'Could not be reached'
}

async function check(row: Row): Promise<Result> {
  const url = row.website as string
  const base = { id: row.id, name: row.business_name, url }
  try {
    // GET rather than HEAD: too many small business sites answer HEAD with an
    // error while serving a normal page.
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'BILD-LinkCheck/1.0 (+https://www.bild.ae)' },
    })
    const ok = res.status < 400 || ALIVE_EXTRA.has(res.status)
    return { ...base, ok, status: res.status, error: ok ? null : describe(res.status) }
  } catch (e) {
    return { ...base, ok: false, status: 0, error: describe(0, e) }
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  if (!authed) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Only listings the public can actually reach.
  const { data, error } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, slug, website, website_fail_count')
    .eq('status', 'approved')
    .is('delisted_at', null)
    .not('website', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data as Row[]).filter(r => r.website && /^https?:\/\//i.test(r.website))
  const results: Result[] = []

  // A small pool rather than all at once: a directory of a hundred listings
  // firing simultaneously looks like an attack to some hosts.
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    results.push(...await Promise.all(rows.slice(i, i + CONCURRENCY).map(check)))
  }

  const checkedAt = new Date().toISOString()
  const newlyBroken: Result[] = []
  const recovered: string[] = []

  for (const r of results) {
    const before = rows.find(x => x.id === r.id)?.website_fail_count ?? 0
    const fails = r.ok ? 0 : before + 1

    await supabaseAdmin
      .from('business_submissions')
      .update({
        website_checked_at: checkedAt,
        website_status: r.status,
        website_fail_count: fails,
        website_error: r.ok ? null : r.error,
      })
      .eq('id', r.id)

    // Alert on the second consecutive failure only, so a one-week blip is
    // never emailed. Alerting every week after that would become noise, so
    // it fires once on the way down.
    if (!r.ok && fails === 2) newlyBroken.push(r)
    if (r.ok && before >= 2) recovered.push(r.name)
  }

  if (newlyBroken.length > 0) {
    await sendBrokenLinkAdminAlert({
      businesses: newlyBroken.map(r => ({ name: r.name, url: r.url, reason: r.error || 'Unknown' })),
      recovered,
    })
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    working: results.filter(r => r.ok).length,
    failing: results.filter(r => !r.ok).length,
    alerted: newlyBroken.length,
    recovered: recovered.length,
    failures: results.filter(r => !r.ok).map(r => ({ name: r.name, url: r.url, reason: r.error })),
  })
}
