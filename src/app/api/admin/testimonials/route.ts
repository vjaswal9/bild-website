import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendBusinessReviewNotification } from '@/lib/email'
import { revalidatePublic, TESTIMONIAL_PATHS } from '@/lib/revalidate-public'

export const dynamic = 'force-dynamic'

function authed(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

// Approve or reject a pending testimonial.
export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id, status } = await req.json().catch(() => ({}))
  if (!id || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Missing id or invalid status' }, { status: 400 })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('testimonials')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select('name, quote, rating, business_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Approving a review of a directory business tells that business it is live.
  // Only on approval - a business should never hear about a review we rejected.
  const review = rows?.[0]
  if (status === 'approved' && review?.business_id) {
    try {
      const { data: biz } = await supabaseAdmin
        .from('business_submissions')
        .select('email, business_name, slug')
        .eq('id', review.business_id)
        .maybeSingle()
      if (biz?.email) {
        const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
        const base = process.env.NEXT_PUBLIC_SITE_URL || origin
        await sendBusinessReviewNotification({
          to: biz.email,
          businessName: biz.business_name,
          reviewerName: review.name,
          rating: review.rating,
          quote: review.quote,
          profileUrl: `${base}/directory/${biz.slug}`,
        })
      }
    } catch (e) {
      // Never fail the approval just because the notification email didn't send.
      console.error('Business review notification failed:', e)
    }
  }

  revalidatePublic(TESTIMONIAL_PATHS)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await supabaseAdmin.from('testimonials').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublic(TESTIMONIAL_PATHS)
  return NextResponse.json({ ok: true })
}
