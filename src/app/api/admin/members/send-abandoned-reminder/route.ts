import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendAbandonedJoinReminder } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Matches the wait on the members screen. Someone who has not paid yet may
// simply still be on the payment page, and a "did you have trouble?" email in
// the middle of paying reads badly.
const REMINDER_WAIT_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, full_name, email, gender, status, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.status !== 'pending') {
    return NextResponse.json({ error: 'This member is no longer abandoned.' }, { status: 400 })
  }
  if (!member.email) return NextResponse.json({ error: 'This member has no email on file.' }, { status: 400 })
  const readyAt = new Date(member.created_at).getTime() + REMINDER_WAIT_MS
  if (Date.now() < readyAt) {
    const at = new Date(readyAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })
    return NextResponse.json({
      error: `They started less than an hour ago and may still be paying. You can send the reminder from ${at} (UAE time).`,
    }, { status: 400 })
  }

  await sendAbandonedJoinReminder({ to: member.email, name: member.full_name, gender: member.gender })

  const sentAt = new Date().toISOString()
  const { error } = await supabaseAdmin.from('members').update({ abandoned_reminder_sent_at: sentAt }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, sentAt })
}
