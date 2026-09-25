import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, MONEY_COOKIE, verifyAdminToken, verifyMoneyToken } from '@/lib/admin-auth'
import { PaymentKind } from '@/lib/money'

export const dynamic = 'force-dynamic'

// The Money screens need the standing admin session AND the short-lived
// Money unlock, so these endpoints cannot be used from a signed-in tab that
// has not passed the second password check.
async function moneyGuard(req: NextRequest): Promise<boolean> {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) return false
  return verifyMoneyToken(req.cookies.get(MONEY_COOKIE)?.value)
}

export const maxDuration = 60

// Rebuilds the payment ledger from Stripe.
//
// The ledger only started being written live when the Money dashboard was
// added, and directory listing and Featured payments were never recorded
// anywhere before that at all: the database kept a "paid until" date and
// nothing else. This route walks Stripe's own record of what happened and
// fills the gap, so a full year of history is available rather than only
// payments taken from today onwards.
//
// It is safe to run repeatedly. Rows already in the ledger are left exactly
// as they are, so a webhook-written row is never overwritten by a
// reconstructed one.

const MAX_SESSIONS = 2000
const MAX_CHARGES = 2000

type LedgerRow = {
  paid_at: string
  kind: PaymentKind
  description: string
  reference_id: string | null
  event_id: string | null
  gross_aed: number
  revenue_aed: number
  fee_passed_on_aed: number
  stripe_fee_aed: number
  refunded_aed: number
  currency: string
  stripe_session_id: string
  stripe_charge_id: string | null
  source: string
}

function classify(metadata: Record<string, string> | null | undefined): PaymentKind {
  switch (metadata?.type) {
    case 'event': return 'event_ticket'
    case 'business_listing': return 'listing'
    case 'business_featured': return 'featured'
    default: return 'membership'
  }
}

export async function POST(req: NextRequest) {
  if (!(await moneyGuard(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const fromYear = Number(body.fromYear) || 2024
  const gte = Math.floor(Date.UTC(fromYear, 0, 1) / 1000)

  try {
    // 1. Every charge in the window, with the real fee from its balance
    //    transaction. Fetched as one paged list rather than one retrieve per
    //    payment, which would be hundreds of round trips.
    const charges = await stripe.charges
      .list({ created: { gte }, limit: 100, expand: ['data.balance_transaction'] })
      .autoPagingToArray({ limit: MAX_CHARGES })

    type ChargeInfo = { id: string; feeAed: number; refundedAed: number; created: number }
    const byPaymentIntent = new Map<string, ChargeInfo>()
    for (const c of charges) {
      if (!c.paid || c.status !== 'succeeded') continue
      const pi = typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id
      if (!pi) continue
      const bt = c.balance_transaction
      const feeMinor = bt && typeof bt !== 'string' ? (bt.fee ?? 0) : 0
      byPaymentIntent.set(pi, {
        id: c.id,
        feeAed: Math.round(feeMinor) / 100,
        refundedAed: (c.amount_refunded ?? 0) / 100,
        created: c.created,
      })
    }

    // 2. Every completed checkout session in the window. Sessions carry the
    //    metadata that says what was actually bought; charges do not.
    const sessions = await stripe.checkout.sessions
      .list({ created: { gte }, limit: 100 })
      .autoPagingToArray({ limit: MAX_SESSIONS })

    const paid = sessions.filter(s => s.payment_status === 'paid')

    // 3. Ticket revenue for event bookings, so the passed-on card fee is not
    //    counted as income. amount_aed is what BILD actually keeps.
    const regIds = paid
      .map(s => s.metadata?.registration_id)
      .filter((v): v is string => !!v)
    const regMap = new Map<string, { amount: number; eventId: string }>()
    if (regIds.length) {
      for (let i = 0; i < regIds.length; i += 200) {
        const { data } = await supabaseAdmin
          .from('event_registrations')
          .select('id, amount_aed, event_id, status')
          .in('id', regIds.slice(i, i + 200))
        for (const r of data || []) {
          regMap.set(String(r.id), { amount: Number(r.amount_aed) || 0, eventId: String(r.event_id) })
        }
      }
    }

    const rows: LedgerRow[] = []
    let skippedNoCharge = 0

    for (const s of paid) {
      const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id
      const info = pi ? byPaymentIntent.get(pi) : undefined
      if (!info) skippedNoCharge++

      const kind = classify(s.metadata as Record<string, string> | null)
      const grossAed = (s.amount_total ?? 0) / 100
      if (grossAed <= 0) continue

      let revenueAed = grossAed
      let eventId: string | null = null
      let referenceId: string | null = null
      let description = 'Payment'

      if (kind === 'event_ticket') {
        const regId = s.metadata?.registration_id || null
        const reg = regId ? regMap.get(regId) : undefined
        referenceId = regId
        eventId = reg?.eventId ?? null
        // Fall back to the gross if the registration has since been deleted:
        // better to slightly overstate revenue than to lose the payment.
        revenueAed = reg ? reg.amount : grossAed
        description = s.metadata?.ticket_name ? `Event ticket - ${s.metadata.ticket_name}` : 'Event ticket'
      } else if (kind === 'listing') {
        referenceId = s.metadata?.business_id || null
        description = 'Directory listing'
      } else if (kind === 'featured') {
        referenceId = s.metadata?.business_id || null
        description = 'Featured placement'
      } else {
        referenceId = s.client_reference_id || null
        description = 'Membership'
      }

      const createdSec = info?.created ?? s.created
      rows.push({
        paid_at: new Date(createdSec * 1000).toISOString(),
        kind,
        description,
        reference_id: referenceId,
        event_id: eventId,
        gross_aed: Math.round(grossAed * 100) / 100,
        revenue_aed: Math.round(revenueAed * 100) / 100,
        fee_passed_on_aed: Math.max(0, Math.round((grossAed - revenueAed) * 100) / 100),
        stripe_fee_aed: info?.feeAed ?? 0,
        refunded_aed: info?.refundedAed ?? 0,
        currency: (s.currency || 'aed').toLowerCase(),
        stripe_session_id: s.id,
        stripe_charge_id: info?.id ?? null,
        source: 'backfill',
      })
    }

    // 4. Insert, leaving anything already recorded untouched.
    let inserted = 0
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200)
      const { data, error } = await supabaseAdmin
        .from('payments')
        .upsert(batch, { onConflict: 'stripe_session_id', ignoreDuplicates: true })
        .select('id')
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      inserted += (data || []).length
    }

    // 5. Bring rows that already exist back in line on the one figure that
    //    legitimately changes after a payment is first recorded: how much of
    //    it has since been refunded.
    //
    //    The insert above deliberately leaves existing rows alone, which is
    //    right for everything else on them: descriptions, the revenue split
    //    and any manual correction an admin has made should survive an
    //    import. But it also meant this tool could never repair a refund, so
    //    a refund issued in the Stripe dashboard stayed invisible to the
    //    Money dashboard permanently, with no way back except editing the
    //    row by hand. This pass is narrow on purpose: refunded_aed, and a
    //    charge id where one was never recorded.
    let corrected = 0
    const bySession = new Map(rows.map(r => [r.stripe_session_id, r]))
    const sessionIds = rows.map(r => r.stripe_session_id)
    for (let i = 0; i < sessionIds.length; i += 200) {
      const { data: existing, error: readError } = await supabaseAdmin
        .from('payments')
        .select('id, stripe_session_id, refunded_aed, stripe_charge_id')
        .in('stripe_session_id', sessionIds.slice(i, i + 200))
      if (readError) {
        return NextResponse.json({ error: readError.message }, { status: 500 })
      }
      for (const row of existing || []) {
        const fresh = bySession.get(row.stripe_session_id as string)
        if (!fresh) continue
        const patch: Record<string, unknown> = {}
        if (Math.abs((Number(row.refunded_aed) || 0) - fresh.refunded_aed) >= 0.005) {
          patch.refunded_aed = fresh.refunded_aed
        }
        if (!row.stripe_charge_id && fresh.stripe_charge_id) {
          patch.stripe_charge_id = fresh.stripe_charge_id
        }
        if (Object.keys(patch).length === 0) continue
        const { error: fixError } = await supabaseAdmin.from('payments').update(patch).eq('id', row.id)
        if (fixError) {
          // One row failing should not abandon an import that is otherwise
          // repairing the ledger.
          console.error('Could not correct a payment during import:', fixError)
          continue
        }
        corrected += 1
      }
    }

    // Stamp the run, even when it found nothing new: "last checked" is the
    // useful fact, not "last time something changed". Wrapped so a missing
    // column can never fail an import that otherwise succeeded.
    const importedAt = new Date().toISOString()
    try {
      await supabaseAdmin
        .from('admin_settings')
        .update({ last_stripe_import_at: importedAt })
        .eq('id', 1)
    } catch (e) {
      console.error('Could not record the Stripe import timestamp:', e)
    }

    return NextResponse.json({
      ok: true,
      importedAt,
      sessionsScanned: sessions.length,
      paidSessions: paid.length,
      chargesScanned: charges.length,
      rowsPrepared: rows.length,
      inserted,
      corrected,
      alreadyRecorded: rows.length - inserted,
      missingChargeDetail: skippedNoCharge,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
