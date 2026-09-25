import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { loadRegistration, refundRegistration } from '@/lib/event-refunds'

export const dynamic = 'force-dynamic'

// Refunds an event booking, in full or in part, issuing the real Stripe
// refund in the same action.
//
// Full and partial are recorded differently on purpose. A full refund ends
// the booking: status becomes 'refunded' and the person drops off the door
// list and the ticket count. A partial one does not, because they are still
// coming and have simply had some money back.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, amountAed, note, notAttending, adminFeeAed } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // A booking that could not be read is not a booking that does not exist.
  // Saying "not found" for a database blip sent admins looking for a booking
  // that was sitting in the door list all along.
  let reg
  try {
    reg = await loadRegistration(String(id))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'The booking could not be read just now.' },
      { status: 503 },
    )
  }
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  if (reg.status === 'refunded') return NextResponse.json({ error: 'Already refunded' }, { status: 400 })
  if (reg.status !== 'paid') return NextResponse.json({ error: 'Only paid bookings can be refunded' }, { status: 400 })

  // No amount given means whatever is left on the booking, which is the
  // long-standing behaviour of the Refund button.
  const fallback = Math.round(((Number(reg.amount_aed) || 0) - (Number(reg.refunded_amount_aed) || 0)) * 100) / 100
  const requested = amountAed == null ? fallback : Number(amountAed)

  try {
    const outcome = await refundRegistration(reg, {
      amountAed: requested,
      note,
      forceClose: notAttending === true,
      adminFeeAed: Number.isFinite(Number(adminFeeAed)) ? Number(adminFeeAed) : undefined,
    })
    return NextResponse.json({ ok: true, ...outcome })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not process the refund.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
