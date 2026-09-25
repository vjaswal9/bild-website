import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendDirectoryLeadsWeeklyReport } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Weekly digest of businesses that started the directory form and never
// finished it - the directory counterpart to the abandoned-join report.
//
// A lead is only worth reporting once. Without that, the same half-finished
// application would appear every Monday until somebody deleted it, and a
// report that repeats itself stops being read - which is exactly how a useful
// signal turns into noise.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const cronOk =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  const adminOk = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!cronOk && !adminOk) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const dryRun = adminOk && req.nextUrl.searchParams.get('dry') === '1'

  // An hour's grace. Somebody filling the form in right now has not abandoned
  // anything, and emailing about them would be both wrong and slightly
  // unnerving.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: open, error } = await supabaseAdmin
    .from('directory_leads')
    .select('business_name, owner_name, email, phone, fields_filled, created_at')
    .is('completed_at', null)
    .is('reported_at', null)
    .lt('updated_at', cutoff)
    .order('fields_filled', { ascending: false })
  if (error) {
    return NextResponse.json({ error: `Could not read leads: ${error.message}` }, { status: 500 })
  }

  // Came back and finished since the last report - the encouraging half.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recovered } = await supabaseAdmin
    .from('directory_leads')
    .select('business_name, email')
    .not('completed_at', 'is', null)
    .gte('completed_at', weekAgo)

  const { count: openTotal } = await supabaseAdmin
    .from('directory_leads')
    .select('id', { count: 'exact', head: true })
    .is('completed_at', null)

  const rows = (open || []).map(r => ({
    businessName: r.business_name,
    ownerName: r.owner_name,
    email: r.email,
    phone: r.phone,
    fieldsFilled: r.fields_filled ?? 0,
    startedAt: r.created_at,
  }))

  // Nothing new and nobody recovered: stay quiet rather than send an empty
  // email every week.
  if (!rows.length && !(recovered || []).length) {
    return NextResponse.json({ ok: true, sent: false, reason: 'nothing to report', openTotal: openTotal ?? 0 })
  }

  if (!dryRun) {
    await sendDirectoryLeadsWeeklyReport({
      rows,
      recoveredThisWeek: (recovered || []).map(r => ({ businessName: r.business_name, email: r.email })),
      openTotal: openTotal ?? 0,
    })

    // Mark only what was actually reported. Done after the send, so a failed
    // email does not silently swallow a week of leads.
    if (rows.length) {
      const { error: markErr } = await supabaseAdmin
        .from('directory_leads')
        .update({ reported_at: new Date().toISOString() })
        .in('email', rows.map(r => r.email))
      if (markErr) console.error('Could not mark leads as reported:', markErr.message)
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    sent: !dryRun,
    reported: rows.length,
    recovered: (recovered || []).length,
    openTotal: openTotal ?? 0,
    rows: dryRun ? rows : undefined,
  })
}
