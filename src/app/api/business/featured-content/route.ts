import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { stripDashes } from '@/lib/utils'
import { revalidatePublic, directoryPaths } from '@/lib/revalidate-public'
import { toEmbedUrl } from '@/lib/video-embed'

// Public, token-gated: the business's standing "manage Featured content"
// link posts here to update their extended profile content. Only usable
// while Featured is active.
export async function POST(req: NextRequest) {
  if (await isRateLimitedShared(`featured-content:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 20 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, slug, featured, featured_paid_until')
    .eq('featured_manage_token', body.token)
    .maybeSingle()

  if (!biz) return NextResponse.json({ error: 'Invalid link.' }, { status: 404 })

  const isActive = biz.featured && (biz.featured_paid_until == null || new Date(biz.featured_paid_until) >= new Date())
  if (!isActive) {
    return NextResponse.json({ error: 'Your Featured status has lapsed. Renew to manage your content.' }, { status: 403 })
  }

  // Photos can only be files uploaded to our own storage. Anything else a
  // browser sent is dropped rather than stored and later shown to the public.
  const storagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/business-logos/`
  const galleryUrls: string[] = Array.isArray(body.gallery_urls)
    ? body.gallery_urls.filter((u: unknown): u is string => typeof u === 'string' && u.startsWith(storagePrefix)).slice(0, 6)
    : []

  // The video must be a YouTube or Vimeo link; it is stored in embed form.
  const rawVideo = typeof body.video_url === 'string' ? body.video_url.trim() : ''
  const videoEmbed = rawVideo ? toEmbedUrl(rawVideo) : null
  if (rawVideo && !videoEmbed) {
    return NextResponse.json({ error: 'The video link must be a YouTube or Vimeo address, for example https://www.youtube.com/watch?v=...' }, { status: 400 })
  }
  const offers = Array.isArray(body.offers) ? body.offers.filter((o: string) => o?.trim()).slice(0, 10).map(stripDashes) : []

  const { error } = await supabaseAdmin
    .from('business_submissions')
    .update({
      featured_bio: stripDashes(body.bio) || null,
      featured_gallery_urls: galleryUrls,
      featured_video_url: videoEmbed,
      featured_offers: offers,
    })
    .eq('id', biz.id)

  if (error) {
    console.error('featured content save failed:', error.message)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }

  // Same reason as the testimonial route: this writes the extended bio, gallery
  // and video that a Featured profile shows, and that page is prerendered.
  revalidatePublic(directoryPaths(biz?.slug))
  return NextResponse.json({ ok: true })
}
