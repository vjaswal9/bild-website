import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { getTwoFactorState, checkSecondFactor, updateTwoFactor } from '@/lib/admin-2fa'
import { subjectFromRequest } from '@/lib/admin-accounts'

export const dynamic = 'force-dynamic'

// Turns two-factor off. Needs the password AND a current code (or a recovery
// code), so somebody who walks up to an unlocked admin session cannot quietly
// remove the protection.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (await isRateLimitedShared(`admin-2fa-disable:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })
    || await isRateLimitedShared('admin-2fa-global', { windowMs: 10 * 60 * 1000, max: 15 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const { password, code } = await req.json().catch(() => ({}))
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }
  const subject = (await subjectFromRequest(req)) ?? null
  const tf = await getTwoFactorState(subject)
  if (!tf.ok) return NextResponse.json({ error: 'Could not read the setting. Please try again.' }, { status: 503 })
  if (!tf.state.enabled) return NextResponse.json({ ok: true })
  // A personal account cannot sign in without an authenticator. To change
  // phone use "Move to a new phone"; to leave, another admin removes the account.
  if (subject !== null) {
    return NextResponse.json({ error: 'Two-factor login is required on personal accounts. Use "Move to a new phone" to change device.' }, { status: 409 })
  }
  if (typeof code !== 'string' || !(await checkSecondFactor(tf.state, code, subject))) {
    return NextResponse.json({ error: 'That code is not right.' }, { status: 401 })
  }

  const saved = await updateTwoFactor(subject, {
    totp_enabled: false, totp_secret: null, totp_pending_secret: null, totp_recovery: [], totp_last_step: null,
  })
  if (!saved) return NextResponse.json({ error: 'Could not switch it off. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
