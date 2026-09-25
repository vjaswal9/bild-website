import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { str, uuid, oneOf } from '@/lib/validate'
import { sendBusinessTestimonialApproved, sendBusinessTestimonialDeclined } from '@/lib/email'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'

type Row = {
  id: string
  business_id: string
  customer_name: string
  quote: string
  proof_path: string | null
  status: string
  decline_reason: string | null
  created_at: string
  reviewed_at: string | null
}

// The moderation queue for testimonials businesses have sent in about
// themselves. Separate from BILD's own testimonials, which are written by the
// person giving the praise and need no evidence.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('business_testimonials')
    .select('id, business_id, customer_name, quote, proof_path, status, decline_reason, created_at, reviewed_at')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) {
    console.error('Could not load business testimonials:', error)
    return NextResponse.json({ error: 'Could not load testimonials. Please try again.' }, { status: 503 })
  }

  const rows = (data || []) as Row[]
  // One query for the names rather than one per row.
  const ids = Array.from(new Set(rows.map(r => r.business_id)))
  const names = new Map<string, { name: string; slug: string | null }>()
  if (ids.length) {
    const { data: bizRows } = await supabaseAdmin
      .from('business_submissions')
      .select('id, business_name, slug')
      .in('id', ids)
    for (const b of bizRows || []) names.set(b.id, { name: b.business_name, slug: b.slug })
  }

  return NextResponse.json({
    testimonials: rows.map(r => ({
      ...r,
      businessName: names.get(r.business_id)?.name || 'Unknown business',
      businessSlug: names.get(r.business_id)?.slug || null,
    })),
  })
}

// Approve or decline one. Declining requires a reason, because the reason is
// emailed to the business and "no" on its own tells them nothing they can act
// on.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const id = uuid(body.id)
  const action = oneOf(body.action, ['approved', 'declined'] as const, 'approved')
  const reason = str(body.reason, 600)

  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  if (action === 'declined' && reason.length < 5) {
    return NextResponse.json({ error: 'Please give a reason. It is emailed to the business.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('business_testimonials')
    .update({
      status: action,
      reviewed_at: new Date().toISOString(),
      decline_reason: action === 'declined' ? reason : null,
    })
    .eq('id', id)
    .select('business_id, customer_name')
    .single()

  if (error || !data) {
    console.error('Could not update a business testimonial:', error)
    return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  }

  // Tell the business either way. The decision is invisible to them otherwise,
  // and a declined testimonial with no explanation just gets sent again.
  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('business_name, slug, email, featured_manage_token')
    .eq('id', data.business_id)
    .maybeSingle()

  if (biz?.email) {
    if (action === 'approved') {
      await sendBusinessTestimonialApproved({
        to: biz.email,
        businessName: biz.business_name,
        customerName: data.customer_name,
        profileUrl: `${SITE_URL}/directory/${biz.slug}`,
      })
    } else {
      await sendBusinessTestimonialDeclined({
        to: biz.email,
        businessName: biz.business_name,
        customerName: data.customer_name,
        reason,
        manageUrl: `${SITE_URL}/directory/manage/${biz.featured_manage_token}`,
      })
    }
  }

  return NextResponse.json({ ok: true, emailedTo: biz?.email || null })
}

// Removes a testimonial outright, including one already live.
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const id = uuid(body.id)
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('business_testimonials')
    .delete()
    .eq('id', id)
    .select('proof_path')

  if (error) {
    console.error('Could not delete a business testimonial:', error)
    return NextResponse.json({ error: 'Could not delete that. Please try again.' }, { status: 500 })
  }

  const path = data?.[0]?.proof_path
  if (path) await supabaseAdmin.storage.from('testimonial-proof').remove([path])

  return NextResponse.json({ ok: true })
}
