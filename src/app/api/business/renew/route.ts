import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendRenewalSubmittedAdminAlert } from '@/lib/email'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Public endpoint: a business's self-service document renewal form (linked from
// their expiry reminder email) posts here. Never touches the live document_url/
// document_expiry_date/delisted_at fields directly - only stages the renewal in
// pending_* columns for an admin to approve or decline.
export async function POST(req: NextRequest) {
  if (isRateLimited(`renew:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !body.token || !body.document_url || !body.document_expiry_date) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, business_country, renewal_token_expires_at, pending_renewal_submitted_at')
    .eq('renewal_token', String(body.token))
    .maybeSingle()

  if (!biz) {
    return NextResponse.json({ error: 'This renewal link is not valid.' }, { status: 404 })
  }
  if (biz.renewal_token_expires_at && new Date(biz.renewal_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'This renewal link has expired. Please contact connect@bild.ae.' }, { status: 410 })
  }
  if (biz.pending_renewal_submitted_at) {
    return NextResponse.json({ error: 'A renewal has already been submitted for this business.' }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from('business_submissions')
    .update({
      pending_document_url: String(body.document_url),
      pending_document_expiry_date: String(body.document_expiry_date),
      pending_renewal_submitted_at: new Date().toISOString(),
    })
    .eq('id', biz.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    await sendRenewalSubmittedAdminAlert({
      businessName: biz.business_name,
      newExpiryDate: String(body.document_expiry_date),
      country: biz.business_country === 'UK' ? 'UK' : 'UAE',
    })
  } catch (e) {
    console.error('Renewal submitted admin alert failed:', e)
  }

  return NextResponse.json({ ok: true })
}
