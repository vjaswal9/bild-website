import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendFeaturedManageLinkEmail, testRecipients } from '@/lib/email'

export const dynamic = 'force-dynamic'
// One email per business with a pause between them, to stay inside the email
// provider's rate limit, takes longer than a default function run.
export const maxDuration = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

type Row = {
  id: string
  business_name: string
  email: string | null
  featured: boolean | null
  featured_paid_until: string | null
  featured_manage_token: string | null
  listing_paid_until: string | null
  listing_fee_exempt: boolean | null
  listing_abandoned_at: string | null
}

function featuredActive(r: Row) {
  return !!r.featured && (r.featured_paid_until == null || new Date(r.featured_paid_until) >= new Date())
}
function isLive(r: Row) {
  return !!r.listing_fee_exempt || (!!r.listing_paid_until && new Date(r.listing_paid_until) >= new Date())
}

async function recipients(): Promise<Row[]> {
  const { data, error } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, email, featured, featured_paid_until, featured_manage_token, listing_paid_until, listing_fee_exempt, listing_abandoned_at')
    .eq('status', 'approved')
    .is('delisted_at', null)
    .order('business_name', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data || []) as Row[]).filter(r => !!r.email)
}

// Emails businesses their manage link, which is how they send in customer
// testimonials. Every approved business has one now, not only Featured ones.
//
//   GET          the list, so the admin can choose who to send to.
//   mode "test"  both versions of the email to the owner's inbox, no business.
//   mode "send"  one personal email to each chosen business.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const rows = await recipients()
    return NextResponse.json({
      businesses: rows.map(r => ({
        id: r.id,
        businessName: r.business_name,
        email: r.email,
        featured: featuredActive(r),
        live: isLive(r),
        neverPaid: !!r.listing_abandoned_at,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load the list.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))

  let rows: Row[]
  try {
    rows = await recipients()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load the list.' }, { status: 503 })
  }

  // ---- Test: both versions to the owner, nothing to any business ----
  if (body.mode === 'test') {
    const to = testRecipients()
    const results = []
    for (const featured of [false, true]) {
      const r = await sendFeaturedManageLinkEmail({
        to: Array.isArray(to) ? to[0] : to,
        businessName: 'Your Business Name',
        // A link that goes nowhere real, so pressing it in a test email can
        // never open a customer's manage page.
        manageUrl: `${SITE_URL}/directory/manage/test-link-not-real`,
        featured,
      })
      results.push({ version: featured ? 'Featured business' : 'Standard listing', ok: r.ok, reason: r.reason })
      await pause(700)
    }
    return NextResponse.json({ ok: results.every(r => r.ok), sentTo: to, results })
  }

  // ---- Send: one email each to the chosen businesses ----
  if (body.mode === 'send') {
    const chosen = new Set<string>(Array.isArray(body.ids) ? body.ids.map(String) : [])
    const targets = rows.filter(r => chosen.has(r.id))
    if (targets.length === 0) {
      return NextResponse.json({ error: 'No businesses selected.' }, { status: 400 })
    }

    const results = []
    for (const t of targets) {
      // A business approved before manage links existed may still have none.
      let token = t.featured_manage_token
      if (!token) {
        token = randomUUID().replace(/-/g, '')
        const { error } = await supabaseAdmin
          .from('business_submissions')
          .update({ featured_manage_token: token })
          .eq('id', t.id)
        if (error) {
          results.push({ id: t.id, businessName: t.business_name, ok: false, reason: 'Could not create a link.' })
          continue
        }
      }
      const r = await sendFeaturedManageLinkEmail({
        to: t.email as string,
        businessName: t.business_name,
        manageUrl: `${SITE_URL}/directory/manage/${token}`,
        featured: featuredActive(t),
      })
      results.push({ id: t.id, businessName: t.business_name, email: t.email, ok: r.ok, reason: r.reason })
      await pause(600)
    }

    return NextResponse.json({
      ok: results.every(r => r.ok),
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    })
  }

  return NextResponse.json({ error: 'Unknown mode.' }, { status: 400 })
}
