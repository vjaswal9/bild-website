import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { getTwoFactorState } from '@/lib/admin-2fa'
import { verifyTotp, generateRecoveryCodes, hashRecoveryCode } from '@/lib/totp'

export const dynamic = 'force-dynamic'

// Step two: the admin types the code their app now shows. Only a correct code
// switches two-factor on, which proves the phone is set up before the password
// alone stops being enough. Returns the one-time recovery codes, once.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (await isRateLimitedShared(`admin-2fa-enable:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const { code } = await req.json().catch(() => ({}))
  const tf = await getTwoFactorState()
  if (!tf.ok) return NextResponse.json({ error: 'Could not read the setting. Please try again.' }, { status: 503 })
  if (tf.state.enabled) return NextResponse.json({ error: 'Two-factor login is already on.' }, { status: 409 })
  if (!tf.state.pendingSecret) {
    return NextResponse.json({ error: 'Start the setup again to get a new QR code.' }, { status: 400 })
  }

  const step = typeof code === 'string' ? await verifyTotp(tf.state.pendingSecret, code, null) : null
  if (step == null) {
    return NextResponse.json({ error: 'That code did not match. Check the code in your app and try again.' }, { status: 401 })
  }

  const codes = generateRecoveryCodes(8)
  const hashes = await Promise.all(codes.map(hashRecoveryCode))
  const { error } = await supabaseAdmin.from('admin_settings').update({
    totp_secret: tf.state.pendingSecret,
    totp_pending_secret: null,
    totp_enabled: true,
    totp_recovery: hashes,
    totp_last_step: step,
  }).eq('id', 1)
  if (error) return NextResponse.json({ error: 'Could not switch it on. Please try again.' }, { status: 500 })

  return NextResponse.json({ ok: true, recoveryCodes: codes })
}
