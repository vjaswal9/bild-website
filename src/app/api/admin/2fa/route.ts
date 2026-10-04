import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { getTwoFactorState } from '@/lib/admin-2fa'

export const dynamic = 'force-dynamic'

// Whether two-factor login is on, for the Security page.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const tf = await getTwoFactorState()
  if (!tf.ok) return NextResponse.json({ error: 'Could not read the setting. Please try again.' }, { status: 503 })
  return NextResponse.json({
    available: tf.state.available,
    enabled: tf.state.enabled,
    recoveryCodesLeft: tf.state.recovery.length,
  })
}
