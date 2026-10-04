import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { imageCheckConfigured, scanPending } from '@/lib/image-check'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Checks the next batch of unchecked photos. The review page's "Check now"
// button and the gallery upload both call this; a daily cron does the rest.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (!imageCheckConfigured()) {
    return NextResponse.json({ error: 'The photo check is not switched on yet: ANTHROPIC_API_KEY is missing.' }, { status: 503 })
  }
  // Small batches so the request finishes well inside the time limit.
  return NextResponse.json(await scanPending(9))
}
