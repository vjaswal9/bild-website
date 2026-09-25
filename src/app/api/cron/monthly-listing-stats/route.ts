import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMonthlyStatsEmail } from '@/lib/email'
import { CLICK_KINDS, KIND_LABEL, totalClicks, type Totals } from '@/lib/directory-stats'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'

// The first month this email is allowed to report on.
//
// Daily tracking started on 22 September 2026, so September is a fragment - a
// business told it got eight views in September would reasonably conclude the
// directory is dead, when in truth only nine days were counted. October is the
// first complete month, which makes 1 November the first send.
//
// Left as a constant rather than deleted once it has passed: it documents when
// the figures actually begin, and stops a future backfill quietly emailing
// months that were never fully recorded.
const FIRST_REPORTED_MONTH = '2026-10-01'

// The monthly performance email for Featured listings.
//
// Scheduled for the 1st. A business that is told in January what it got in
// December renews in March without being chased; one that only hears from BILD
// when an invoice is due treats the fee as a cost rather than a return.
//
// Sent to Featured listings only - the click breakdown is the paid benefit.
// Standard listings are counted all the same, so the figures exist the moment
// one of them upgrades, and so there is a real number to make the offer with.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const cronOk =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  const adminOk = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!cronOk && !adminOk) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // An admin can preview without anything being sent.
  const dryRun = adminOk && req.nextUrl.searchParams.get('dry') === '1'

  // Calendar months, not rolling windows: "your November" is a claim a business
  // can check, "the last 30 days" is one they cannot.
  const now = new Date()
  const startThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const startLast = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const startPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const monthLabel = startLast.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  // Nothing before the first complete month, however the job is triggered.
  // A dry run still reports what it would have done, so the guard can be seen
  // rather than just trusted.
  if (iso(startLast) < FIRST_REPORTED_MONTH) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason:
        `${monthLabel} is before the first complete month of tracking. ` +
        `Reporting begins with ${new Date(FIRST_REPORTED_MONTH).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}, ` +
        `so the first email sends on 1 November 2026.`,
      month: monthLabel,
      firstReportedMonth: FIRST_REPORTED_MONTH,
      sent: 0,
    })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('directory_events')
    .select('business_id, kind, day, count')
    .gte('day', iso(startPrev))
    .lt('day', iso(startThis))
  if (error) {
    return NextResponse.json({ error: `Could not read statistics: ${error.message}` }, { status: 500 })
  }

  const lastMonth = new Map<string, Totals>()
  const prevMonth = new Map<string, Totals>()
  for (const r of rows || []) {
    const bucket = r.day >= iso(startLast) ? lastMonth : prevMonth
    const t = bucket.get(r.business_id) || {}
    const k = r.kind as keyof Totals
    t[k] = (t[k] || 0) + (Number(r.count) || 0)
    bucket.set(r.business_id, t)
  }

  const nowIso = new Date().toISOString()
  const { data: businesses, error: bizErr } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, email, featured, featured_paid_until, featured_manage_token, delisted_at, status')
    .eq('status', 'approved')
    .eq('featured', true)
    .is('delisted_at', null)
  if (bizErr) {
    return NextResponse.json({ error: `Could not read businesses: ${bizErr.message}` }, { status: 500 })
  }

  const live = (businesses || []).filter(
    b => b.featured_paid_until == null || b.featured_paid_until >= nowIso,
  )

  const sent: string[] = []
  const skipped: { name: string; why: string }[] = []

  for (const b of live) {
    const t = lastMonth.get(b.id) || {}
    const p = prevMonth.get(b.id) || {}
    const views = t.view || 0
    const clicks = totalClicks(t)

    // Nothing happened, so there is nothing worth saying. An email reporting
    // zero views does the opposite of what this email is for.
    if (views === 0 && clicks === 0) {
      skipped.push({ name: b.business_name, why: 'no activity last month' })
      continue
    }
    if (!b.email) {
      skipped.push({ name: b.business_name, why: 'no email on file' })
      continue
    }
    if (!b.featured_manage_token) {
      skipped.push({ name: b.business_name, why: 'no manage token' })
      continue
    }
    if (dryRun) {
      sent.push(`${b.business_name} (${views} views, ${clicks} enquiries)`)
      continue
    }

    try {
      await sendMonthlyStatsEmail({
        to: b.email,
        businessName: b.business_name,
        monthLabel,
        views,
        viewsPrev: p.view || 0,
        clicks,
        clicksPrev: totalClicks(p),
        breakdown: CLICK_KINDS.map(k => ({ label: KIND_LABEL[k], count: t[k] || 0 })),
        manageUrl: `${SITE}/directory/manage/${b.featured_manage_token}`,
      })
      sent.push(`${b.business_name} (${views} views, ${clicks} enquiries)`)
    } catch (e) {
      skipped.push({ name: b.business_name, why: `send failed: ${(e as Error).message}` })
    }
    // Same courtesy pause the other bulk senders use, to stay inside Resend's
    // rate limit.
    await new Promise(r => setTimeout(r, 600))
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    month: monthLabel,
    featuredLive: live.length,
    sent: sent.length,
    sentTo: sent,
    skipped,
  })
}
