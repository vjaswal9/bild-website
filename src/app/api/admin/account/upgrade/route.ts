import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE, verifyAdminToken, personalAccountsActive,
  signAdminSession, hashPassword, forgetSessionChecks,
} from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { isValidEmail } from '@/lib/email-validate'
import { str } from '@/lib/validate'
import { getTwoFactorState } from '@/lib/admin-2fa'
import { normaliseAdminEmail, subjectFromRequest } from '@/lib/admin-accounts'
import { sendAdminAccountAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Switches the site from the single shared login to personal accounts. The
// signed-in admin becomes the first account, keeping their current password
// and authenticator, so nothing changes for them except that sign-in now asks
// for their email too. The shared login's details stay in admin_settings, so
// emptying admin_users in an emergency puts the old login back.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if ((await subjectFromRequest(req)) !== null || (await personalAccountsActive()) !== false) {
    return NextResponse.json({ error: 'Personal accounts are already on.' }, { status: 409 })
  }
  if (await isRateLimitedShared(`admin-upgrade:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!(await verifyAdminPassword(password, null))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }
  const email = normaliseAdminEmail(body?.email)
  const name = str(body?.name, 100)
  if (!name || !email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Please give your name and email address.' }, { status: 400 })
  }

  // Everyone with a personal account must have an authenticator.
  const tf = await getTwoFactorState(null)
  if (!tf.ok || !tf.state.enabled || !tf.state.secret) {
    return NextResponse.json({ error: 'Turn on two-factor login first, then switch to personal accounts.' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin.from('admin_users').insert({
    email, name, active: true,
    password_hash: await hashPassword(password),
    totp_secret: tf.state.secret,
    totp_enabled: true,
    totp_recovery: tf.state.recovery,
    totp_last_step: tf.state.lastStep,
    last_login_at: new Date().toISOString(),
  }).select('id').single()
  if (error || !data) {
    console.error('admin upgrade: could not create the first account', error?.message)
    return NextResponse.json({ error: 'Could not switch on personal accounts. Nothing has changed.' }, { status: 500 })
  }
  forgetSessionChecks()

  // The shared-login session that made this request stops working the moment
  // the first account exists, so sign them in as that account right away.
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, await signAdminSession(data.id as string), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: ADMIN_SESSION_MAX_AGE, path: '/',
  })
  await sendAdminAccountAlert({ event: 'activated', name, email, by: name })
  return res
}
