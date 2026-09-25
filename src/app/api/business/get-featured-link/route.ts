import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { sendGetFeaturedLinkEmail } from '@/lib/email'

// Public "resend my Get Featured link" endpoint - never exposes the token
// directly, and always returns the same generic message regardless of
// whether the email matched, so it can't be used to probe the directory.
export async function POST(req: NextRequest) {
  if (isRateLimited(`get-featured-link:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const { email } = await req.json().catch(() => ({}))
  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })

  const generic = { ok: true, message: "If we found a listing under that email, we've sent the link." }

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, email, featured_payment_token, status')
    .eq('email', String(email).trim())
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!biz) return NextResponse.json(generic)

  let token = biz.featured_payment_token
  if (!token) {
    token = randomUUID().replace(/-/g, '')
    await supabaseAdmin.from('business_submissions').update({ featured_payment_token: token }).eq('id', biz.id)
  }

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
  const base = process.env.NEXT_PUBLIC_SITE_URL || origin
  try {
    await sendGetFeaturedLinkEmail({
      to: biz.email,
      businessName: biz.business_name,
      featuredUrl: `${base}/directory/feature/${token}`,
    })
  } catch (e) {
    console.error('Get Featured link email failed:', e)
  }

  return NextResponse.json(generic)
}
