import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { revalidatePublic, directoryPaths } from '@/lib/revalidate-public'
import { sendListingPausedBusinessEmail } from '@/lib/email'
import { buildPauseReason } from '@/lib/listing-pause'
import { stripDashes } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae').replace(/\/+$/, '')
const RENEWAL_LINK_DAYS = 30

// Takes an approved listing off the directory without deleting anything.
//
// It uses the same switch as an expired document (delisted_at), so the listing
// disappears from the directory, its profile page, the sitemap and every
// reminder or stats email with no further changes. The reason is recorded so
// the admin screens can tell a pause from an expiry.
//
// Optionally emails the business asking for their documents, with the same
// upload link an expired listing gets. When an admin approves what they upload,
// the existing renewal approval puts the listing back live.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const note = stripDashes(String(body.note || '')).replace(/\s+/g, ' ').trim().slice(0, 300)
  const sendEmail = body.email === true

  const { data: biz, error: readError } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, email, status, delisted_at, business_country, renewal_token, renewal_token_expires_at')
    .eq('id', id)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!biz) return NextResponse.json({ error: 'That business was not found.' }, { status: 404 })
  if (biz.status !== 'approved') {
    return NextResponse.json({ error: 'Only an approved listing can be paused.' }, { status: 400 })
  }
  if (biz.delisted_at) {
    return NextResponse.json({ error: 'This listing is already off the directory (paused, or removed for an expired document).' }, { status: 409 })
  }

  // The .is() guard means a second click, or the daily document check running
  // at the same moment, cannot pause it twice or overwrite the first reason.
  const { data: paused, error } = await supabaseAdmin
    .from('business_submissions')
    .update({ delisted_at: new Date().toISOString(), delisted_reason: buildPauseReason(note) })
    .eq('id', id)
    .is('delisted_at', null)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!paused || paused.length === 0) {
    return NextResponse.json({ error: 'This listing was changed by someone else. Please refresh and check.' }, { status: 409 })
  }

  revalidatePublic(directoryPaths())

  // The pause is done and stands whatever happens below.
  let emailed = false
  let emailProblem: string | undefined
  if (sendEmail) {
    try {
      let token = biz.renewal_token as string | null
      const expiresAt = biz.renewal_token_expires_at ? new Date(biz.renewal_token_expires_at as string) : null
      if (!token || (expiresAt && expiresAt < new Date())) {
        token = randomUUID().replace(/-/g, '')
        const { error: tokenError } = await supabaseAdmin
          .from('business_submissions')
          .update({
            renewal_token: token,
            renewal_token_expires_at: new Date(Date.now() + RENEWAL_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', id)
        if (tokenError) throw new Error(tokenError.message)
      }
      const sent = await sendListingPausedBusinessEmail({
        to: String(biz.email),
        businessName: String(biz.business_name),
        note,
        renewalUrl: `${SITE_URL}/directory/renew/${token}`,
        country: biz.business_country === 'UK' ? 'UK' : 'UAE',
      })
      emailed = sent.ok
      if (!sent.ok) emailProblem = sent.reason
    } catch (e) {
      emailProblem = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json({ ok: true, emailed, ...(emailProblem ? { emailProblem } : {}) })
}
