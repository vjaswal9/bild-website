import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendFeaturedManageLinkEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'

// Emails a Featured business its standing link to manage its Featured content.
//
// Paying for Featured creates this link and emails it automatically. A business
// switched to Featured by an admin skipped that step, so it had no link and no
// way to add its bio, photos, video, offers or brochure.
//
// An existing link is reused, never replaced, so a link the business already
// holds keeps working. The link is also returned to the admin, who can copy it
// if the email does not arrive.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, email, status, featured, featured_paid_until, featured_manage_token')
    .eq('id', id)
    .maybeSingle()

  if (!biz) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  if (biz.status !== 'approved') return NextResponse.json({ error: 'Only approved listings have a manage page.' }, { status: 400 })
  // Featured is no longer required. The manage page now carries the customer
  // testimonials form, which every approved business may use, and only the
  // Featured content section inside it is gated on Featured being paid up.
  if (!biz.email) return NextResponse.json({ error: 'This listing has no email address to send to.' }, { status: 400 })

  let token = biz.featured_manage_token as string | null
  if (!token) {
    token = randomUUID().replace(/-/g, '')
    const { error } = await supabaseAdmin
      .from('business_submissions')
      .update({ featured_manage_token: token })
      .eq('id', biz.id)
      .is('featured_manage_token', null)
    if (error) return NextResponse.json({ error: `Could not create the link: ${error.message}` }, { status: 500 })

    // If two admins pressed the button at once, keep whichever link was saved
    // first, so the business is never sent a link that no longer works.
    const { data: saved } = await supabaseAdmin
      .from('business_submissions')
      .select('featured_manage_token')
      .eq('id', biz.id)
      .single()
    token = saved?.featured_manage_token || token
  }

  const manageUrl = `${SITE_URL}/directory/manage/${token}`

  // A lapsed Featured business gets the plain wording too: its Featured
  // section is locked, so promising it photos and a brochure would be a lie.
  const featuredActive = !!biz.featured &&
    (biz.featured_paid_until == null || new Date(biz.featured_paid_until) >= new Date())

  const outcome = await sendFeaturedManageLinkEmail({
    to: biz.email,
    businessName: biz.business_name,
    manageUrl,
    featured: featuredActive,
  })

  return NextResponse.json({
    ok: outcome.ok,
    sentTo: biz.email,
    manageUrl,
    createdNewLink: !biz.featured_manage_token,
    emailError: outcome.ok ? undefined : outcome.reason,
  }, { status: outcome.ok ? 200 : 502 })
}
