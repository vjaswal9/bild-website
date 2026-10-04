import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE, signAdminSession, forgetSessionChecks } from '@/lib/admin-auth'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { findByInviteToken } from '@/lib/admin-accounts'
import { verifyTotp, generateRecoveryCodes, hashRecoveryCode } from '@/lib/totp'
import { sendAdminAccountAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Step two: the invited person types the code their app shows. A correct code
// switches the account on, retires the invitation link, signs them in, and
// hands over their one-time recovery codes.
export async function POST(req: NextRequest) {
  if (await isRateLimitedShared(`admin-invite:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 15 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }
  const { token, code } = await req.json().catch(() => ({}))
  const row = await findByInviteToken(token)
  if (!row) return NextResponse.json({ error: 'This invitation link is not valid any more. Ask the admin who invited you to send a new one.' }, { status: 410 })
  // Each link gets its own cap on code guesses.
  if (await isRateLimitedShared(`admin-invite-code:${row.id}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }
  if (!row.totp_pending_secret) {
    return NextResponse.json({ error: 'Go back one step to choose a password and get your QR code.' }, { status: 400 })
  }

  const step = typeof code === 'string' ? await verifyTotp(row.totp_pending_secret, code, null) : null
  if (step == null) {
    return NextResponse.json({ error: 'That code did not match. Check the code in your app and try again.' }, { status: 401 })
  }

  const codes = generateRecoveryCodes(8)
  const { error } = await supabaseAdmin.from('admin_users').update({
    totp_secret: row.totp_pending_secret,
    totp_pending_secret: null,
    totp_enabled: true,
    totp_recovery: await Promise.all(codes.map(hashRecoveryCode)),
    totp_last_step: step,
    active: true,
    invite_token_hash: null,
    invite_expires_at: null,
    last_login_at: new Date().toISOString(),
    sessions_valid_from: new Date().toISOString(),
  }).eq('id', row.id)
  if (error) return NextResponse.json({ error: 'Could not finish setting up. Please try again.' }, { status: 500 })
  forgetSessionChecks()

  const res = NextResponse.json({ ok: true, recoveryCodes: codes })
  res.cookies.set(ADMIN_COOKIE, await signAdminSession(row.id), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: ADMIN_SESSION_MAX_AGE, path: '/',
  })
  await sendAdminAccountAlert({ event: 'activated', name: row.name, email: row.email, by: row.name })
  return res
}
