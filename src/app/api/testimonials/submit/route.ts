import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTestimonialSubmittedAdminAlert } from '@/lib/email'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { stripDashes } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Public endpoint: the "Share your experience" form posts here. Submissions
// start pending and are only shown on the site once an admin approves them.
export async function POST(req: NextRequest) {
  if (isRateLimited(`testimonial-submit:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const name = String(body?.name || '').trim()
  const quote = String(body?.quote || '').trim()
  const rating = Number(body?.rating)
  if (!name || !quote || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Please fill in your name, a rating, and your review.' }, { status: 400 })
  }
  if (quote.length > 1000) {
    return NextResponse.json({ error: 'Please keep your review under 1000 characters.' }, { status: 400 })
  }

  // This endpoint is for testimonials about BILD itself, which appear on the
  // homepage. Reviews attached to a directory business used to be handled here
  // too, behind a switch that was never turned on. That system has been
  // replaced: a business now sends in testimonials its own customers gave it,
  // with a screenshot as proof, through /api/business/testimonials.
  if (body?.businessId) {
    return NextResponse.json(
      { error: 'Testimonials for a business are sent in by the business itself, from its manage link.' },
      { status: 400 },
    )
  }

  const payload = {
    name: stripDashes(name),
    headline: body?.headline ? stripDashes(String(body.headline).trim()).slice(0, 100) : null,
    quote: stripDashes(quote),
    rating,
    status: 'pending' as const,
  }

  const { error } = await supabaseAdmin.from('testimonials').insert([payload])
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    await sendTestimonialSubmittedAdminAlert({
      name: payload.name, quote: payload.quote, rating: payload.rating,
    })
  } catch (e) {
    console.error('Testimonial submitted alert failed:', e)
  }

  return NextResponse.json({ ok: true })
}
