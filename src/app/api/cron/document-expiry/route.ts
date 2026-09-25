import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  sendLicenseExpiryReminder,
  sendLicenseExpiryAdminAlert,
  sendLicenseDelistedAdminAlert,
  sendLicenseDelistedBusinessEmail,
} from '@/lib/email'

export const dynamic = 'force-dynamic'

// Daily document-expiry sweep: reminds businesses 3 days before their UAE
// trade license or UK registration document expires, and auto-delists any
// business whose document has expired without a renewal on file. Triggered
// by Vercel Cron (Authorization: Bearer CRON_SECRET) or manually with the
// x-cron-secret header.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`
  const today = new Date().toISOString().slice(0, 10)
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // --- Reminder pass: document expires within 3 days, no reminder sent yet ---
  const { data: expiringSoon } = await supabaseAdmin
    .from('business_submissions')
    .select('*')
    .eq('status', 'approved')
    .is('delisted_at', null)
    .not('document_expiry_date', 'is', null)
    .gt('document_expiry_date', today)
    .lte('document_expiry_date', in3Days)
    .is('document_reminder_sent_at', null)

  let reminded = 0
  for (const biz of expiringSoon || []) {
    const country = biz.business_country === 'UK' ? 'UK' : 'UAE'
    const token = randomUUID().replace(/-/g, '')
    const expiresAt = new Date(new Date(biz.document_expiry_date).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabaseAdmin
      .from('business_submissions')
      .update({
        renewal_token: token,
        renewal_token_expires_at: expiresAt,
        document_reminder_sent_at: new Date().toISOString(),
      })
      .eq('id', biz.id)
      .is('document_reminder_sent_at', null) // guards against a double-send if the cron overlaps itself

    if (error) {
      console.error('Document reminder: failed to update row', biz.id, error)
      continue
    }

    const renewalUrl = `${origin}/directory/renew/${token}`
    try {
      await sendLicenseExpiryReminder({
        to: biz.email,
        businessName: biz.business_name,
        expiryDate: biz.document_expiry_date,
        renewalUrl,
        country,
      })
      await sendLicenseExpiryAdminAlert({
        businessName: biz.business_name,
        expiryDate: biz.document_expiry_date,
        country,
      })
      reminded++
    } catch (e) {
      console.error('Document reminder emails failed for', biz.id, e)
    }
  }

  // --- Delist pass: document expiry date has passed, never renewed ---
  const { data: expired } = await supabaseAdmin
    .from('business_submissions')
    .select('*')
    .eq('status', 'approved')
    .is('delisted_at', null)
    .not('document_expiry_date', 'is', null)
    .lt('document_expiry_date', today)

  let delisted = 0
  for (const biz of expired || []) {
    const country = biz.business_country === 'UK' ? 'UK' : 'UAE'

    // The reminder pass normally already generated a renewal token, but if a
    // business was delisted without ever going through that pass (e.g. an
    // admin manually set an already-past expiry date), generate one now so
    // the removal email always has a working self-service renewal link.
    let token = biz.renewal_token
    let tokenExpiresAt = biz.renewal_token_expires_at
    const update: Record<string, unknown> = { delisted_at: new Date().toISOString(), delisted_reason: 'document_expired' }
    if (!token) {
      token = randomUUID().replace(/-/g, '')
      tokenExpiresAt = new Date(new Date(biz.document_expiry_date).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
      update.renewal_token = token
      update.renewal_token_expires_at = tokenExpiresAt
    }

    const { error } = await supabaseAdmin
      .from('business_submissions')
      .update(update)
      .eq('id', biz.id)
      .is('delisted_at', null) // guards against a double-send if the cron overlaps itself

    if (error) {
      console.error('Document delist: failed to update row', biz.id, error)
      continue
    }

    try {
      await sendLicenseDelistedAdminAlert({
        businessName: biz.business_name,
        expiryDate: biz.document_expiry_date,
        country,
      })
      await sendLicenseDelistedBusinessEmail({
        to: biz.email,
        businessName: biz.business_name,
        expiryDate: biz.document_expiry_date,
        renewalUrl: `${origin}/directory/renew/${token}`,
        country,
      })
      delisted++
    } catch (e) {
      console.error('Document delisted emails failed for', biz.id, e)
    }
  }

  return NextResponse.json({ ok: true, reminded, delisted })
}
