import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken, personalAccountsActive } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { isValidEmail } from '@/lib/email-validate'
import { str } from '@/lib/validate'
import {
  subjectFromRequest, listAdmins, findAdminByEmail, issueInvite, endSessions,
  normaliseAdminEmail, countActiveAdmins,
} from '@/lib/admin-accounts'
import { sendAdminInviteEmail, sendAdminAccountAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'

const siteBase = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'

// Who the signed-in admin is acting as, or an error response. Every action
// here needs a personal account: the shared login has no one to credit.
async function actor(req: NextRequest): Promise<{ id: string } | NextResponse> {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const subject = await subjectFromRequest(req)
  if (!subject) {
    return NextResponse.json({ error: 'Turn on personal accounts first (Admin, Security).' }, { status: 409 })
  }
  return { id: subject }
}

async function actorName(id: string): Promise<string> {
  const { data } = await supabaseAdmin.from('admin_users').select('name, email').eq('id', id).maybeSingle()
  const r = data as { name?: string; email?: string } | null
  return r?.name || r?.email || 'An admin'
}

// The admins list for the Security page.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const personal = (await personalAccountsActive()) === true
  if (!personal) return NextResponse.json({ personal: false, admins: [] })
  const subject = await subjectFromRequest(req)
  return NextResponse.json({ personal: true, currentId: subject, admins: await listAdmins() })
}

// Invite a new admin. Needs the inviter's own password again.
export async function POST(req: NextRequest) {
  const a = await actor(req)
  if (a instanceof NextResponse) return a
  if (await isRateLimitedShared(`admin-users:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  if (!(await verifyAdminPassword(body?.password, a.id))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }
  const email = normaliseAdminEmail(body?.email)
  const name = str(body?.name, 100)
  if (!name || !email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Please give a name and a valid email address.' }, { status: 400 })
  }

  const existing = await findAdminByEmail(email)
  if (existing?.active) return NextResponse.json({ error: 'That person is already an admin.' }, { status: 409 })

  let id = existing?.id
  if (!id) {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .insert({ email, name, active: false, invited_by: a.id })
      .select('id')
      .single()
    if (error || !data) {
      console.error('admin invite: could not create account', error?.message)
      return NextResponse.json({ error: 'Could not create the invitation. Please try again.' }, { status: 500 })
    }
    id = data.id as string
  } else {
    await supabaseAdmin.from('admin_users').update({ name, invited_by: a.id }).eq('id', id)
  }

  const { token } = await issueInvite(id)
  const by = await actorName(a.id)
  await sendAdminInviteEmail({ to: email, name, invitedBy: by, link: `${siteBase()}/admin/invite/${token}` })
  await sendAdminAccountAlert({ event: 'added', name, email, by })
  return NextResponse.json({ ok: true })
}

// Send a pending invitation again (the old link stops working).
export async function PATCH(req: NextRequest) {
  const a = await actor(req)
  if (a instanceof NextResponse) return a
  const { id } = await req.json().catch(() => ({}))
  const { data } = await supabaseAdmin.from('admin_users').select('id, email, name, active').eq('id', String(id || '')).maybeSingle()
  const row = data as { id: string; email: string; name: string; active: boolean } | null
  if (!row || row.active) return NextResponse.json({ error: 'There is no pending invitation to resend.' }, { status: 404 })
  if (await isRateLimitedShared(`admin-users:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }
  const { token } = await issueInvite(row.id)
  await sendAdminInviteEmail({ to: row.email, name: row.name, invitedBy: await actorName(a.id), link: `${siteBase()}/admin/invite/${token}` })
  return NextResponse.json({ ok: true })
}

// Remove an admin (or cancel an invitation). Needs the remover's password.
// The person is signed out of every device at once, and their password and
// authenticator are wiped, so re-adding them starts from scratch.
export async function DELETE(req: NextRequest) {
  const a = await actor(req)
  if (a instanceof NextResponse) return a
  if (await isRateLimitedShared(`admin-users:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }
  const body = await req.json().catch(() => ({}))
  if (!(await verifyAdminPassword(body?.password, a.id))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }
  const id = String(body?.id || '')
  if (id === a.id) return NextResponse.json({ error: 'You cannot remove your own account. Ask the other admin to do it.' }, { status: 400 })

  const { data } = await supabaseAdmin.from('admin_users').select('id, email, name, active').eq('id', id).maybeSingle()
  const row = data as { id: string; email: string; name: string; active: boolean } | null
  if (!row) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })
  // Always leaves at least the person doing the removing.
  if (row.active && (await countActiveAdmins()) <= 1) {
    return NextResponse.json({ error: 'That is the only admin, so it cannot be removed.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('admin_users').update({
    active: false,
    password_hash: null,
    totp_secret: null, totp_pending_secret: null, totp_enabled: false, totp_recovery: [], totp_last_step: null,
    invite_token_hash: null, invite_expires_at: null,
  }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not remove them. Please try again.' }, { status: 500 })
  await endSessions(id)
  await sendAdminAccountAlert({ event: 'removed', name: row.name, email: row.email, by: await actorName(a.id) })
  return NextResponse.json({ ok: true })
}
