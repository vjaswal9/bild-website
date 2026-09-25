import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendRenewalApprovedEmail, sendRenewalDeclinedEmail } from '@/lib/email'
import { revalidatePublic, directoryPaths } from '@/lib/revalidate-public'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, action, admin_notes } = await req.json().catch(() => ({}))

  if (!['approve', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // A reason is required when declining, since it's emailed to the business.
  if (action === 'decline' && !String(admin_notes || '').trim()) {
    return NextResponse.json({ error: 'Please enter a reason for declining.' }, { status: 400 })
  }

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, email, business_country, pending_document_url, pending_document_expiry_date, pending_renewal_submitted_at')
    .eq('id', id)
    .maybeSingle()

  if (!biz) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }
  if (!biz.pending_renewal_submitted_at) {
    return NextResponse.json({ error: 'No pending renewal for this business.' }, { status: 400 })
  }

  const country = biz.business_country === 'UK' ? 'UK' : 'UAE'

  if (action === 'approve') {
    const { error } = await supabaseAdmin
      .from('business_submissions')
      .update({
        document_url: biz.pending_document_url,
        document_expiry_date: biz.pending_document_expiry_date,
        delisted_at: null,
        delisted_reason: null,
        document_reminder_sent_at: null,
        renewal_token: null,
        renewal_token_expires_at: null,
        pending_document_url: null,
        pending_document_expiry_date: null,
        pending_renewal_submitted_at: null,
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    try {
      await sendRenewalApprovedEmail({
        to: biz.email,
        businessName: biz.business_name,
        newExpiryDate: String(biz.pending_document_expiry_date),
        country,
      })
    } catch (e) {
      console.error('Renewal approved email failed:', e)
    }

    revalidatePublic(directoryPaths())
    return NextResponse.json({ ok: true })
  }

  // decline - leave current live/delisted state untouched, just clear the pending submission
  const { error } = await supabaseAdmin
    .from('business_submissions')
    .update({
      pending_document_url: null,
      pending_document_expiry_date: null,
      pending_renewal_submitted_at: null,
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    await sendRenewalDeclinedEmail({
      to: biz.email,
      businessName: biz.business_name,
      reason: String(admin_notes).trim(),
      country,
    })
  } catch (e) {
    console.error('Renewal declined email failed:', e)
  }

  revalidatePublic(directoryPaths())
  return NextResponse.json({ ok: true })
}
