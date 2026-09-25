import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendPasswordChangedNotification } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Applies a staged password change. Proof of authorisation is the one-time
// token from the confirmation email, so no admin session is required here.
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}))
  if (!token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('admin_settings')
    .select('pending_hash, pending_token, pending_expires')
    .eq('id', 1)
    .maybeSingle()

  const row = data as { pending_hash?: string; pending_token?: string; pending_expires?: string } | null
  if (!row || !row.pending_token || !row.pending_hash) {
    return NextResponse.json({ error: 'No pending password change was found.' }, { status: 400 })
  }
  if (row.pending_token !== token) {
    return NextResponse.json({ error: 'This confirmation link is invalid.' }, { status: 400 })
  }
  if (!row.pending_expires || new Date(row.pending_expires).getTime() < Date.now()) {
    return NextResponse.json({ error: 'This confirmation link has expired. Please start again.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('admin_settings')
    .update({
      password_hash: row.pending_hash,
      pending_hash: null,
      pending_token: null,
      pending_expires: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) {
    return NextResponse.json({ error: 'Could not apply the change. Please try again.' }, { status: 500 })
  }

  // Don't let an email hiccup fail an already-successful password change.
  try {
    await sendPasswordChangedNotification()
  } catch (e) {
    console.error('Password changed notification failed:', e)
  }

  return NextResponse.json({ ok: true })
}
