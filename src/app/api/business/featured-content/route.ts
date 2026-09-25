import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { stripDashes } from '@/lib/utils'

// Public, token-gated: the business's standing "manage Featured content"
// link posts here to update their extended profile content. Only usable
// while Featured is active.
export async function POST(req: NextRequest) {
  if (isRateLimited(`featured-content:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 20 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, featured, featured_paid_until')
    .eq('featured_manage_token', body.token)
    .maybeSingle()

  if (!biz) return NextResponse.json({ error: 'Invalid link.' }, { status: 404 })

  const isActive = biz.featured && (biz.featured_paid_until == null || new Date(biz.featured_paid_until) >= new Date())
  if (!isActive) {
    return NextResponse.json({ error: 'Your Featured status has lapsed. Renew to manage your content.' }, { status: 403 })
  }

  const galleryUrls = Array.isArray(body.gallery_urls) ? body.gallery_urls.slice(0, 6) : []
  const offers = Array.isArray(body.offers) ? body.offers.filter((o: string) => o?.trim()).slice(0, 10).map(stripDashes) : []

  const { error } = await supabaseAdmin
    .from('business_submissions')
    .update({
      featured_bio: stripDashes(body.bio) || null,
      featured_gallery_urls: galleryUrls,
      featured_video_url: body.video_url || null,
      featured_offers: offers,
    })
    .eq('id', biz.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
