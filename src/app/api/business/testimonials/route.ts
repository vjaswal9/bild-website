import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { businessByManageToken } from '@/lib/business-token'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { str, uuid } from '@/lib/validate'
import { sendBusinessTestimonialAdminAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'

const MAX_PENDING = 10

// A business sends in a testimonial one of its own customers gave it.
//
// It arrives pending and shows on the profile page only once an admin has
// approved it. The proof screenshot is the point of the moderation: anyone can
// type a glowing quote, so what is being checked is that a real customer
// really said it.
export async function POST(req: NextRequest) {
  if (isRateLimited(`business-testimonial:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 12 })) {
    return NextResponse.json({ error: 'Too many submissions. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const biz = await businessByManageToken(body?.token)
  if (!biz) {
    return NextResponse.json({ error: 'This link is not valid. Please use the link from your BILD email.' }, { status: 404 })
  }

  const customerName = str(body.customerName, 80)
  const quote = str(body.quote, 1500)
  // The proof path comes back from /api/uploads/sign, which chose it, so it is
  // ours rather than the browser's. Checked anyway so a crafted path cannot
  // point the record at another bucket's file.
  const proofPath = str(body.proofPath, 300)

  if (!customerName) return NextResponse.json({ error: 'Please enter your customer’s name.' }, { status: 400 })
  if (quote.length < 15) return NextResponse.json({ error: 'Please enter what your customer said, in full.' }, { status: 400 })
  if (!proofPath) return NextResponse.json({ error: 'Please attach a screenshot of the original message as proof.' }, { status: 400 })
  if (proofPath.includes('..') || proofPath.startsWith('/')) {
    return NextResponse.json({ error: 'That attachment could not be read. Please upload it again.' }, { status: 400 })
  }

  // Somebody queueing up fifty at once is not sending in testimonials, and it
  // would bury the moderation queue.
  const { count, error: countError } = await supabaseAdmin
    .from('business_testimonials')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', biz.id)
    .eq('status', 'pending')

  if (countError) {
    console.error('Could not count pending testimonials:', countError)
    return NextResponse.json({ error: 'Could not send that just now. Please try again in a moment.' }, { status: 503 })
  }
  if ((count ?? 0) >= MAX_PENDING) {
    return NextResponse.json(
      { error: `You already have ${MAX_PENDING} testimonials waiting to be checked. Please wait for those before sending more.` },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('business_testimonials')
    .insert({
      business_id: biz.id,
      customer_name: customerName,
      quote,
      proof_path: proofPath,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Could not save a business testimonial:', error)
    return NextResponse.json({ error: 'Could not save that just now. Please try again.' }, { status: 500 })
  }

  await sendBusinessTestimonialAdminAlert({
    businessName: biz.business_name,
    customerName,
    quote,
  })

  return NextResponse.json({ ok: true, id: data.id })
}

// Lets a business withdraw one it sent by mistake, while it is still waiting,
// or clear one that was declined. An approved testimonial is on the profile
// page and is the admin's to remove.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const biz = await businessByManageToken(body?.token)
  if (!biz) return NextResponse.json({ error: 'This link is not valid.' }, { status: 404 })

  const id = uuid(body.id)
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('business_testimonials')
    .delete()
    .eq('id', id)
    .eq('business_id', biz.id)
    .in('status', ['pending', 'declined'])
    .select('proof_path')

  if (error) {
    console.error('Could not remove a business testimonial:', error)
    return NextResponse.json({ error: 'Could not remove that just now. Please try again.' }, { status: 500 })
  }
  if (!data?.length) {
    return NextResponse.json({ error: 'That testimonial is already live. Contact us if you need it taken down.' }, { status: 400 })
  }

  // The proof screenshot exists only to justify the testimonial, so it goes
  // with it rather than lingering in storage.
  const path = data[0]?.proof_path
  if (path) await supabaseAdmin.storage.from('testimonial-proof').remove([path])

  return NextResponse.json({ ok: true })
}
