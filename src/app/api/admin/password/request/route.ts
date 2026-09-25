import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken, hashPassword, randomToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { sendPasswordChangeConfirmation } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Must already be signed in as admin.
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Email confirmation is the whole point - refuse if email isn't configured.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'Email is not configured, so the change cannot be confirmed securely. Set RESEND_API_KEY first.' },
      { status: 400 }
    )
  }

  const { currentPassword, newPassword } = await req.json().catch(() => ({}))
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Please enter your current and new password.' }, { status: 400 })
  }
  if (String(newPassword).length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
  }

  // Verify the current password (DB hash if set, else env fallback).
  if (!(await verifyAdminPassword(currentPassword))) {
    return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 401 })
  }

  // Stage the new password behind a one-time, expiring confirmation token.
  const pendingHash = await hashPassword(String(newPassword))
  const token = randomToken()
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes

  const { error } = await supabaseAdmin
    .from('admin_settings')
    .update({ pending_hash: pendingHash, pending_token: token, pending_expires: expires })
    .eq('id', 1)
  if (error) {
    return NextResponse.json({ error: 'Could not stage the change. Please try again.' }, { status: 500 })
  }

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
  const base = process.env.NEXT_PUBLIC_SITE_URL || origin
  const confirmUrl = `${base}/admin/confirm-password?token=${token}`
  const to = await sendPasswordChangeConfirmation({ confirmUrl })

  return NextResponse.json({ ok: true, sentTo: to })
}
