import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { googleReviewsInviteRecipients, googleReviewsLinkFor } from '@/lib/google-reviews-link'
import { sendGoogleReviewsInviteEmail, testRecipients } from '@/lib/email'

export const dynamic = 'force-dynamic'
// Sending one email per business with a pause between them, to stay inside
// the email provider's rate limit, takes longer than a default function run.
export const maxDuration = 60

const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

// Sends the Google reviews invitation.
//   mode "test": both versions to the owner's inbox, and to no business.
//   mode "send": one personal email to each chosen business.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const { recipients, alreadyActive } = await googleReviewsInviteRecipients()

  if (body.mode === 'test') {
    const to = testRecipients()
    // The test uses the owner's own listing for the button, so pressing it in
    // the test email can never change a customer's listing.
    const { data: own } = await (await import('@/lib/supabase-admin')).supabaseAdmin
      .from('business_submissions')
      .select('id, business_name, owner_name, slug')
      .eq('slug', 'kudo-advisory')
      .maybeSingle()
    const sample = own
      ? { id: own.id, businessName: own.business_name, ownerName: own.owner_name, slug: own.slug }
      : recipients[0]
    if (!sample) return NextResponse.json({ error: 'No listing available to build a test from.' }, { status: 400 })
    const linkUrl = await googleReviewsLinkFor(sample.id)

    const results = []
    for (const brokenLink of [false, true]) {
      const r = await sendGoogleReviewsInviteEmail({
        to, ownerName: sample.ownerName, businessName: sample.businessName, slug: sample.slug,
        linkUrl, brokenLink, subjectPrefix: brokenLink ? '[TEST, link did not work version] ' : '[TEST, standard version] ',
      })
      results.push({ version: brokenLink ? 'Link did not work' : 'Standard', ok: r.ok, reason: r.reason })
      await pause(700)
    }
    return NextResponse.json({ ok: results.every(r => r.ok), sentTo: to, results })
  }

  if (body.mode === 'send') {
    const chosen = new Set<string>(Array.isArray(body.ids) ? body.ids.map(String) : [])
    // Re-checked here, not trusted from the page: anyone who has switched
    // Google reviews on since the page loaded is skipped.
    const targets = recipients.filter(r => chosen.has(r.id))
    if (targets.length === 0) return NextResponse.json({ error: 'No businesses selected.' }, { status: 400 })

    const results = []
    for (const t of targets) {
      const linkUrl = await googleReviewsLinkFor(t.id)
      const r = await sendGoogleReviewsInviteEmail({
        to: t.email, ownerName: t.ownerName, businessName: t.businessName, slug: t.slug, linkUrl, brokenLink: t.brokenLink,
      })
      results.push({ id: t.id, businessName: t.businessName, email: t.email, ok: r.ok, reason: r.reason })
      await pause(600)
    }
    const skipped = Array.from(chosen).filter(id => !targets.some(t => t.id === id)).length
    return NextResponse.json({
      ok: results.every(r => r.ok),
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      skippedAlreadyActive: skipped,
      alreadyActive: alreadyActive.length,
      results,
    })
  }

  return NextResponse.json({ error: 'Unknown mode.' }, { status: 400 })
}
