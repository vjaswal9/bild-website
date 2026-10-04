import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE, signAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Shared across every server instance, so the limit is real. 10 tries per 10
  // minutes per address.
  if (await isRateLimitedShared(`admin-login:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    )
  }

  const { password } = await req.json().catch(() => ({ password: '' }))
  if (!password) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const token = await signAdminToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
  })
  return res
}
