import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { getTwoFactorState, checkSecondFactor } from '@/lib/admin-2fa'

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
  const tf = await getTwoFactorState()
  if (!tf.ok) return NextResponse.json({ error: 'Could not read the setting. Please try again.' }, { status: 503 })
  if (!tf.state.enabled) return NextResponse.json({ ok: true })
  if (typeof code !== 'string' || !(await checkSecondFactor(tf.state, code))) {
    return NextResponse.json({ error: 'That code is not right.' }, { status: 401 })
  }

  const { error } = await supabaseAdmin.from('admin_settings').update({
    totp_enabled: false, totp_secret: null, totp_pending_secret: null, totp_recovery: [], totp_last_step: null,
  }).eq('id', 1)
  if (error) return NextResponse.json({ error: 'Could not switch it off. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
