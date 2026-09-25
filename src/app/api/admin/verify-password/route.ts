import { NextRequest, NextResponse } from 'next/server'
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
  const { password } = await req.json().catch(() => ({}))
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
