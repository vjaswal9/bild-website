import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE, signAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { getTwoFactorState, checkSecondFactor } from '@/lib/admin-2fa'

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

  const { password, code } = await req.json().catch(() => ({ password: '', code: '' }))
  if (!password) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  // Second factor. A correct password alone is never enough once it is on.
  const tf = await getTwoFactorState()
  if (!tf.ok) {
    return NextResponse.json({ error: 'Could not check your sign-in settings. Please try again in a moment.' }, { status: 503 })
  }
  if (tf.state.enabled) {
    // Right password, no code yet: ask for it. No session is issued.
    if (typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ needsCode: true })
    }
    // One shared allowance for guessing codes across every address, so a
    // spread-out attacker who somehow holds the password still cannot grind
    // through the million possibilities.
    if (await isRateLimitedShared('admin-2fa-global', { windowMs: 10 * 60 * 1000, max: 15 })) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
    }
    if (!(await checkSecondFactor(tf.state, code))) {
      return NextResponse.json({ error: 'That code is not right.', needsCode: true }, { status: 401 })
    }
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
