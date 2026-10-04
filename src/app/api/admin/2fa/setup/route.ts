import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { getTwoFactorState } from '@/lib/admin-2fa'
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

  const { password } = await req.json().catch(() => ({}))
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const tf = await getTwoFactorState()
  if (!tf.ok) return NextResponse.json({ error: 'Could not read the setting. Please try again.' }, { status: 503 })
  if (!tf.state.available) {
    return NextResponse.json({ error: 'Two-factor login needs one database update first (supabase/admin-2fa.sql).' }, { status: 409 })
  }
  if (tf.state.enabled) {
    return NextResponse.json({ error: 'Two-factor login is already on. Turn it off first to set up a new phone.' }, { status: 409 })
  }

  const secret = generateTotpSecret()
  const { error } = await supabaseAdmin.from('admin_settings').update({ totp_pending_secret: secret }).eq('id', 1)
  if (error) return NextResponse.json({ error: 'Could not start setup. Please try again.' }, { status: 500 })

  const uri = otpauthUri(secret, 'Admin', 'BILD')
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 })
  return NextResponse.json({ secret, qr })
}
