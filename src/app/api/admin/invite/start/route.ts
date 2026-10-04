import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashPassword } from '@/lib/admin-auth'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { findByInviteToken, MIN_ADMIN_PASSWORD } from '@/lib/admin-accounts'
import { generateTotpSecret, otpauthUri } from '@/lib/totp'

export const dynamic = 'force-dynamic'

// Step one of accepting an admin invitation. Public, but useless without the
// one-time link that was emailed: it checks the link, stores the chosen
// password, and returns a QR code for the person's authenticator app. The
// account stays switched off until step two proves the app works.
export async function POST(req: NextRequest) {
  if (await isRateLimitedShared(`admin-invite:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 15 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }
  const { token, password } = await req.json().catch(() => ({}))
  const bad = () => NextResponse.json({ error: 'This invitation link is not valid any more. Ask the admin who invited you to send a new one.' }, { status: 410 })

  const row = await findByInviteToken(token)
  if (!row) return bad()
  if (typeof password !== 'string' || password.length < MIN_ADMIN_PASSWORD || password.length > 200) {
    return NextResponse.json({ error: `Your password must be at least ${MIN_ADMIN_PASSWORD} characters.` }, { status: 400 })
  }

  const secret = generateTotpSecret()
  const { error } = await supabaseAdmin.from('admin_users').update({
    password_hash: await hashPassword(password),
    totp_pending_secret: secret,
  }).eq('id', row.id)
  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })

  const qr = await QRCode.toDataURL(otpauthUri(secret, row.email, 'BILD Admin'), { margin: 1, width: 240 })
  return NextResponse.json({ qr, secret, email: row.email, name: row.name })
}
