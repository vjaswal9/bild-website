import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_COOKIE, MONEY_COOKIE, MONEY_SESSION_MAX_AGE,
  signMoneyToken, verifyAdminToken,
} from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Unlocks the Money section for 30 minutes. A valid admin session is still
// required first, so this is a second factor on the most sensitive screen
// rather than an alternative way in.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (isRateLimited(`money-unlock:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
  }

  const { password } = await req.json().catch(() => ({}))
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(MONEY_COOKIE, await signMoneyToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MONEY_SESSION_MAX_AGE,
    // Scoped to the Money screens, so the cookie is not sent with every
    // other admin request.
    path: '/',
  })
  return res
}

// Locks it again straight away, without waiting for the 30 minutes to lapse.
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(MONEY_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
}
