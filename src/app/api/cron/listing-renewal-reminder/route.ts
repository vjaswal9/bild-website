import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  sendListingRenewalReminder, sendListingRenewalAdminAlert,
  sendListingFinalReminder, sendListingFinalReminderAdminAlert,
  sendListingExpiredEmail, sendListingExpiredAdminAlert,
  sendFeaturedRenewalReminder, sendFeaturedRenewalAdminAlert,
  sendFeaturedFinalReminder, sendFeaturedFinalReminderAdminAlert,
  sendFeaturedExpiredEmail, sendFeaturedExpiredAdminAlert,
  sendListingActivationReminder, sendListingNeverPaidAdminAlert,
} from '@/lib/email'
import { LISTING_MEMBER_FEE_AED, LISTING_NON_MEMBER_FEE_AED, FEATURED_MEMBER_FEE_AED, FEATURED_NON_MEMBER_FEE_AED } from '@/lib/featured-copy'

export const dynamic = 'force-dynamic'

// Daily sweep covering both the annual listing fee and the quarterly
// Featured upgrade: a 14-day-out reminder, a 1-day-out final reminder, and
// an expired notice - each sent to the business and to admins. Triggered by
// Vercel Cron (Authorization: Bearer CRON_SECRET) or manually with the
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
  const now = new Date()
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const in1Day = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const today = now.toISOString()

  let listingReminded = 0, listingFinal = 0, listingExpired = 0
  let featuredReminded = 0, featuredFinal = 0, featuredExpired = 0

  // ---- Base listing fee ----
  const { data: listing14 } = await supabaseAdmin
    .from('business_submissions')
    .select('id, email, business_name, is_bild_member, listing_paid_until')
    .eq('status', 'approved').eq('listing_fee_exempt', false)
    .lte('listing_paid_until', in14Days).gt('listing_paid_until', in1Day)
    .is('listing_renewal_reminder_sent_at', null)

  for (const biz of listing14 || []) {
    const token = randomUUID().replace(/-/g, '')
    await supabaseAdmin.from('business_submissions').update({
      listing_payment_token: token,
      listing_payment_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      listing_renewal_reminder_sent_at: today,
    }).eq('id', biz.id)
    const feeAed = biz.is_bild_member ? LISTING_MEMBER_FEE_AED : LISTING_NON_MEMBER_FEE_AED
    const payUrl = `${origin}/directory/pay/${token}`
    await sendListingRenewalReminder({ to: biz.email, businessName: biz.business_name, feeAed, payUrl })
    await sendListingRenewalAdminAlert({ businessName: biz.business_name, paidUntil: biz.listing_paid_until })
    listingReminded++
  }

  const { data: listingFinalRows } = await supabaseAdmin
    .from('business_submissions')
    .select('id, email, business_name, is_bild_member, listing_paid_until')
    .eq('status', 'approved').eq('listing_fee_exempt', false)
    .lte('listing_paid_until', in1Day).gt('listing_paid_until', today)
    .is('listing_final_reminder_sent_at', null)

  for (const biz of listingFinalRows || []) {
    const token = randomUUID().replace(/-/g, '')
    await supabaseAdmin.from('business_submissions').update({
      listing_payment_token: token,
      listing_payment_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      listing_final_reminder_sent_at: today,
    }).eq('id', biz.id)
    const feeAed = biz.is_bild_member ? LISTING_MEMBER_FEE_AED : LISTING_NON_MEMBER_FEE_AED
    const payUrl = `${origin}/directory/pay/${token}`
    await sendListingFinalReminder({ to: biz.email, businessName: biz.business_name, feeAed, payUrl })
    await sendListingFinalReminderAdminAlert({ businessName: biz.business_name, paidUntil: biz.listing_paid_until })
    listingFinal++
  }

  const { data: listingExpiredRows } = await supabaseAdmin
    .from('business_submissions')
    .select('id, email, business_name, is_bild_member')
    .eq('status', 'approved').eq('listing_fee_exempt', false)
    .lt('listing_paid_until', today)
    .is('listing_expired_notice_sent_at', null)
    .not('listing_paid_until', 'is', null)

  for (const biz of listingExpiredRows || []) {
    const token = randomUUID().replace(/-/g, '')
    await supabaseAdmin.from('business_submissions').update({
      listing_payment_token: token,
      listing_payment_token_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      listing_expired_notice_sent_at: today,
    }).eq('id', biz.id)
    const feeAed = biz.is_bild_member ? LISTING_MEMBER_FEE_AED : LISTING_NON_MEMBER_FEE_AED
    const payUrl = `${origin}/directory/pay/${token}`
    await sendListingExpiredEmail({ to: biz.email, businessName: biz.business_name, feeAed, payUrl })
    await sendListingExpiredAdminAlert({ businessName: biz.business_name })
    listingExpired++
  }

  // ---- Featured upgrade ----
  const { data: featured14 } = await supabaseAdmin
    .from('business_submissions')
    .select('id, email, business_name, is_bild_member, featured_paid_until')
    .eq('status', 'approved').not('featured_paid_until', 'is', null)
    .lte('featured_paid_until', in14Days).gt('featured_paid_until', in1Day)
    .is('featured_renewal_reminder_sent_at', null)

  for (const biz of featured14 || []) {
    const token = randomUUID().replace(/-/g, '')
    await supabaseAdmin.from('business_submissions').update({
      featured_payment_token: token,
      featured_renewal_reminder_sent_at: today,
    }).eq('id', biz.id)
    const feeAed = biz.is_bild_member ? FEATURED_MEMBER_FEE_AED : FEATURED_NON_MEMBER_FEE_AED
    const featuredUrl = `${origin}/directory/feature/${token}`
    await sendFeaturedRenewalReminder({ to: biz.email, businessName: biz.business_name, feeAed, featuredUrl })
    await sendFeaturedRenewalAdminAlert({ businessName: biz.business_name, paidUntil: biz.featured_paid_until })
    featuredReminded++
  }

  const { data: featuredFinalRows } = await supabaseAdmin
    .from('business_submissions')
    .select('id, email, business_name, is_bild_member, featured_paid_until')
    .eq('status', 'approved').not('featured_paid_until', 'is', null)
    .lte('featured_paid_until', in1Day).gt('featured_paid_until', today)
    .is('featured_final_reminder_sent_at', null)

  for (const biz of featuredFinalRows || []) {
    const token = randomUUID().replace(/-/g, '')
    await supabaseAdmin.from('business_submissions').update({
      featured_payment_token: token,
      featured_final_reminder_sent_at: today,
    }).eq('id', biz.id)
    const feeAed = biz.is_bild_member ? FEATURED_MEMBER_FEE_AED : FEATURED_NON_MEMBER_FEE_AED
    const featuredUrl = `${origin}/directory/feature/${token}`
    await sendFeaturedFinalReminder({ to: biz.email, businessName: biz.business_name, feeAed, featuredUrl })
    await sendFeaturedFinalReminderAdminAlert({ businessName: biz.business_name, paidUntil: biz.featured_paid_until })
    featuredFinal++
  }

  const { data: featuredExpiredRows } = await supabaseAdmin
    .from('business_submissions')
    .select('id, email, business_name, is_bild_member')
    .eq('status', 'approved').eq('featured', true).not('featured_paid_until', 'is', null)
    .lt('featured_paid_until', today)
    .is('featured_expired_notice_sent_at', null)

  for (const biz of featuredExpiredRows || []) {
    const token = randomUUID().replace(/-/g, '')
    await supabaseAdmin.from('business_submissions').update({
      featured: false,
      featured_expired_notice_sent_at: today,
      featured_payment_token: token,
    }).eq('id', biz.id)
    const feeAed = biz.is_bild_member ? FEATURED_MEMBER_FEE_AED : FEATURED_NON_MEMBER_FEE_AED
    const featuredUrl = `${origin}/directory/feature/${token}`
    await sendFeaturedExpiredEmail({ to: biz.email, businessName: biz.business_name, feeAed, featuredUrl })
    await sendFeaturedExpiredAdminAlert({ businessName: biz.business_name })
    featuredExpired++
  }

  // ---- Approved, but never paid in the first place ----
  //
  // Everything above chases a listing that lapsed. This chases one that was
  // never live: approved, emailed a payment link, and then nothing. The link
  // lasts seven days and used to just die, leaving the business unable to pay
  // (the payment page tells them to contact BILD) and nobody told.
  //
  // Two days before it expires they get one reminder with a fresh seven-day
  // link. If that one lapses too, the application is archived and the chasing
  // stops. Roughly twelve days and two links in total.
  let activationReminded = 0, neverPaid = 0
  const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()

  const { data: activationDue, error: activationError } = await supabaseAdmin
    .from('business_submissions')
    .select('id, email, business_name, owner_name, is_bild_member, reviewed_at, listing_payment_token_expires_at, listing_activation_reminder_sent_at')
    .eq('status', 'approved')
    .is('listing_paid_until', null)
    .not('listing_fee_exempt', 'is', true)
    .is('listing_abandoned_at', null)
    .lte('listing_payment_token_expires_at', in2Days)

  if (activationError) {
    // Reported rather than swallowed: silently skipping this sweep is exactly
    // how the two businesses went unnoticed for weeks in the first place.
    console.error('Could not sweep for unpaid listings:', activationError)
  }

  for (const biz of activationDue || []) {
    const alreadyReminded = !!biz.listing_activation_reminder_sent_at
    const expiry = biz.listing_payment_token_expires_at
    const hasExpired = !!expiry && new Date(expiry) < now

    if (!alreadyReminded) {
      // Second chance: a fresh link, and the clock restarts.
      const token = randomUUID().replace(/-/g, '')
      const { error } = await supabaseAdmin.from('business_submissions').update({
        listing_payment_token: token,
        listing_payment_token_expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        listing_activation_reminder_sent_at: today,
      }).eq('id', biz.id)
      if (error) {
        console.error('Could not issue an activation reminder link:', error)
        continue
      }
      const feeAed = biz.is_bild_member ? LISTING_MEMBER_FEE_AED : LISTING_NON_MEMBER_FEE_AED
      await sendListingActivationReminder({
        to: biz.email,
        businessName: biz.business_name,
        ownerName: biz.owner_name,
        feeAed,
        payUrl: `${origin}/directory/pay/${token}`,
      })
      activationReminded++
    } else if (hasExpired) {
      // They had the reminder and the second link lapsed as well. Archive it
      // and stop. Only ever archived once the link has actually expired, not
      // while it is still usable.
      const { error } = await supabaseAdmin.from('business_submissions').update({
        listing_abandoned_at: today,
        listing_payment_token: null,
        listing_payment_token_expires_at: null,
      }).eq('id', biz.id)
      if (error) {
        console.error('Could not archive an unpaid listing:', error)
        continue
      }
      await sendListingNeverPaidAdminAlert({
        businessName: biz.business_name,
        approvedOn: biz.reviewed_at,
      })
      neverPaid++
    }
  }

  return NextResponse.json({
    ok: true,
    listing: { reminded: listingReminded, final: listingFinal, expired: listingExpired },
    featured: { reminded: featuredReminded, final: featuredFinal, expired: featuredExpired },
    activation: { reminded: activationReminded, archivedNeverPaid: neverPaid },
  })
}
