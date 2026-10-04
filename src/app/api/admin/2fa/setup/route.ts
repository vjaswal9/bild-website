import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { getTwoFactorState, updateTwoFactor, checkSecondFactor } from '@/lib/admin-2fa'
import { subjectFromRequest } from '@/lib/admin-accounts'
import { generateTotpSecret, otpauthUri } from '@/lib/totp'

export const dynamic = 'force-dynamic'

// Step one of turning two-factor on: after re-confirming the password, makes a
// new secret and returns it as a QR code to scan. Nothing is switched on until
// the admin proves the app works by typing a code (see /enable).
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (await isRateLimitedShared(`admin-2fa-setup:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { password } = body
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const subject = (await subjectFromRequest(req)) ?? null
  const tf = await getTwoFactorState(subject)
  if (!tf.ok) return NextResponse.json({ error: 'Could not read the setting. Please try again.' }, { status: 503 })
  if (!tf.state.available) {
    return NextResponse.json({ error: 'Two-factor login needs one database update first (supabase/admin-2fa.sql).' }, { status: 409 })
  }
  if (tf.state.enabled) {
    if (subject === null) {
      return NextResponse.json({ error: 'Two-factor login is already on. Turn it off first to set up a new phone.' }, { status: 409 })
    }
    // A personal account must always have an authenticator, so moving to a new
    // phone is a replacement, not a switch-off. Prove the current one first.
    if (await isRateLimitedShared(`admin-2fa:${subject}`, { windowMs: 10 * 60 * 1000, max: 15 })) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
    }
    const current = typeof body?.currentCode === 'string' ? body.currentCode : ''
    if (!current || !(await checkSecondFactor(tf.state, current, subject))) {
      return NextResponse.json({ error: 'Enter a current code from your existing authenticator (or a recovery code) to move to a new phone.' }, { status: 401 })
    }
  }

  const secret = generateTotpSecret()
  const saved = await updateTwoFactor(subject, { totp_pending_secret: secret })
  if (!saved) return NextResponse.json({ error: 'Could not start setup. Please try again.' }, { status: 500 })

  const uri = otpauthUri(secret, 'Admin', 'BILD')
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 })
  return NextResponse.json({ secret, qr })
}
