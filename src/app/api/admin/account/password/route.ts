import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE, verifyAdminToken, signAdminSession, hashPassword,
} from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { getTwoFactorState, checkSecondFactor } from '@/lib/admin-2fa'
import { subjectFromRequest, endSessions, MIN_ADMIN_PASSWORD } from '@/lib/admin-accounts'

export const dynamic = 'force-dynamic'

// A personal account changes its own password. Needs the current password and
// a current authenticator code, so a stolen session alone cannot take over the
// account. Every other session of this person ends; this one carries on.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const me = await subjectFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Use the existing password change for the shared login.' }, { status: 409 })
  if (await isRateLimitedShared(`admin-pw:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 8 })
    || await isRateLimitedShared(`admin-2fa:${me}`, { windowMs: 10 * 60 * 1000, max: 15 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const next = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (next.length < MIN_ADMIN_PASSWORD || next.length > 200) {
    return NextResponse.json({ error: `The new password must be at least ${MIN_ADMIN_PASSWORD} characters.` }, { status: 400 })
  }
  if (!(await verifyAdminPassword(body?.currentPassword, me))) {
    return NextResponse.json({ error: 'Your current password is not right.' }, { status: 401 })
  }
  const tf = await getTwoFactorState(me)
  if (!tf.ok) return NextResponse.json({ error: 'Could not check your settings. Please try again.' }, { status: 503 })
  if (typeof body?.code !== 'string' || !(await checkSecondFactor(tf.state, body.code, me))) {
    return NextResponse.json({ error: 'That authenticator code is not right.' }, { status: 401 })
  }

  const { error } = await supabaseAdmin.from('admin_users').update({ password_hash: await hashPassword(next) }).eq('id', me)
  if (error) return NextResponse.json({ error: 'Could not change the password. Please try again.' }, { status: 500 })
  await endSessions(me)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, await signAdminSession(me), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: ADMIN_SESSION_MAX_AGE, path: '/',
  })
  return res
}
