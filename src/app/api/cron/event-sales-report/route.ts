import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { buildEventSalesReport } from '@/lib/event-sales-report'
import { sendEventSalesReport } from '@/lib/email'

export const dynamic = 'force-dynamic'

// The daily ticket report.
//
// Runs itself every morning, and only sends when an event is actually close
// enough to be worth an email: a report that arrives every day of the year
// stops being read long before the week that matters.
//
// An admin can also press send from the dashboard, which is what `force` is
// for: it sends the report even when nothing is inside the window, so the
// email can be seen on demand rather than only when an event happens to be
// near.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const cronOk =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  const adminOk = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!cronOk && !adminOk) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Only a signed-in admin may force a send. The scheduled run always obeys
  // the window.
  const force = adminOk && req.nextUrl.searchParams.get('force') === '1'

  const { rows, inWindow, windowDays } = await buildEventSalesReport()

  if (inWindow.length === 0 && !force) {
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: `No event within ${windowDays} days, so nothing was sent.`,
      upcoming: rows.length,
    })
  }

  const outcome = await sendEventSalesReport({ rows, windowDays })
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, sent: false, error: outcome.reason }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    forced: force && inWindow.length === 0,
    eventsInWindow: inWindow.length,
    eventsTotal: rows.length,
    tickets: inWindow.reduce((s, r) => s + r.tickets, 0),
  })
}
