import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendInviteReissuedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Generates a fresh single-use WhatsApp invite for a paid member whose
// original one expired unused, and emails it to them.
//
// This is the fix for a gap that existed the whole time this feature has
// been live: the "This link has expired" page a member sees promises "email
// us and we will send you a fresh invite the same day", but nothing on the
// admin side ever actually did that - the only two places that ever wrote
// invite_token were the original signup and the Stripe webhook, neither of
// which regenerates one. This route is the first thing that does.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { data: member, error: readErr } = await supabaseAdmin
    .from('members')
    .select('id, full_name, email, status')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!member) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
  // Only a paid member has an invite in the first place - the WhatsApp groups
  // are a paid-membership benefit, not something a pending or imported row
  // was ever entitled to.
  if (member.status !== 'paid') {
    return NextResponse.json({ error: 'Only a paid member has an invite to reissue.' }, { status: 400 })
  }

  const newToken = randomUUID().replace(/-/g, '')
  const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  // opened_at and used_at are cleared along with the token: they describe the
  // OLD link's history, and would otherwise make the brand new link look
  // instantly stale (or, worse, already used) the moment it is generated.
  const { error: updateErr } = await supabaseAdmin
    .from('members')
    .update({
      invite_token: newToken,
      invite_expires_at: newExpiry,
      invite_used_at: null,
      invite_opened_at: null,
    })
    .eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'
  await sendInviteReissuedEmail({
    to: member.email,
    name: member.full_name,
    inviteUrl: `${siteUrl}/j/${newToken}`,
  })

  return NextResponse.json({ ok: true, expiresAt: newExpiry })
}
