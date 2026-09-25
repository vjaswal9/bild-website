import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { isEventKind, recordEvent } from '@/lib/directory-stats'
import { uuid } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// Records a click on one of a listing's outbound links.
//
// Rate limited harder than the rest of the site. These numbers are shown to a
// business as the justification for a fee, and the obvious abuse is a business
// sitting on its own profile inflating its own figures. The per-day de-dupe in
// the database already makes that pointless, but the limit stops anyone
// hammering the endpoint to make the table grow.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (isRateLimited(`dir-track:${ip}`, { windowMs: 60 * 1000, max: 30 })) {
    // 204 rather than 429 on purpose: this is fire-and-forget telemetry and
    // the visitor must never see anything go wrong because of it.
    return new NextResponse(null, { status: 204 })
  }

  const body = await req.json().catch(() => ({}))
  const businessId = uuid(body?.businessId)
  const kind = body?.kind

  // Views arrive here too now. They used to be recorded during the server
  // render, which is what forced every profile page to be dynamic; the page is
  // cached instead and ViewTracker reports the view from the browser.
  //
  // Inflating a figure this way is bounded by the same two defences as clicks:
  // one event per visitor per listing per kind per day in the database, and a
  // rate limit above. Somebody determined enough to rotate IP addresses could
  // move the number, but they could equally load the page 500 times.
  if (!businessId || !isEventKind(kind)) {
    return new NextResponse(null, { status: 204 })
  }

  // The listing must be real, approved and live. Without this the table could
  // be filled with rows for ids that do not exist.
  const { data: biz, error } = await supabaseAdmin
    .from('business_submissions')
    .select('id')
    .eq('id', businessId)
    .eq('status', 'approved')
    .is('delisted_at', null)
    .maybeSingle()
  if (error || !biz) return new NextResponse(null, { status: 204 })

  await recordEvent({ businessId, kind, ip, userAgent: req.headers.get('user-agent') })
  return new NextResponse(null, { status: 204 })
}
