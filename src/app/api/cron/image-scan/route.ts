import { NextRequest, NextResponse } from 'next/server'
import { imageCheckConfigured, scanPending } from '@/lib/image-check'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendImageReviewAdminAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily sweep of the photos nobody has looked at yet - mainly images that
// businesses uploaded themselves to their directory listing. Emails an admin
// when something needs a decision.
//
// Triggered by Vercel Cron (Authorization: Bearer CRON_SECRET) or manually
// with the x-cron-secret header.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  if (!authed) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!imageCheckConfigured()) return NextResponse.json({ skipped: 'ANTHROPIC_API_KEY not set' })

  const result = await scanPending(15)

  // Tell an admin about anything waiting, but only when this run found
  // something new - not every morning about the same photo.
  let emailed = false
  if (result.flagged > 0) {
    const { count } = await supabaseAdmin
      .from('image_checks').select('id', { count: 'exact', head: true }).eq('status', 'flagged')
    await sendImageReviewAdminAlert({ newlyFlagged: result.flagged, totalWaiting: count || result.flagged })
    emailed = true
  }
  return NextResponse.json({ ...result, emailed })
}
