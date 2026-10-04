import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'

export const dynamic = 'force-dynamic'

// Re-confirms the admin password without performing any action - used to
// gate access to sensitive edit screens (e.g. Manage event) behind a second
// check, beyond the standing admin session cookie.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  // A stolen session cookie should not be able to guess the password offline-fast.
  if (await isRateLimitedShared(`admin-verify:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }
  const { password } = await req.json().catch(() => ({}))
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
