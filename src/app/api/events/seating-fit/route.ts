import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { partyFit } from '@/lib/seating-fit'

export const dynamic = 'force-dynamic'

// "Can a party this size still be seated together?" - asked by the booking
// form once somebody has picked enough tickets to matter, so it can say so
// before they pay rather than leaving it for the admin team to discover.
//
// Answers with a status only, never how many seats or tables are left: that
// number is not shown anywhere public, and a booking form is not the place to
// start publishing it. Public and unauthenticated, so rate limited.
export async function GET(req: NextRequest) {
  if (isRateLimited(`seating-fit:${getClientIp(req)}`, { windowMs: 60 * 1000, max: 30 })) {
    return NextResponse.json({ status: 'ok' })
  }

  const eventId = req.nextUrl.searchParams.get('eventId') || ''
  const party = Math.floor(Number(req.nextUrl.searchParams.get('party')))
  if (!eventId || !Number.isFinite(party) || party < 2) {
    return NextResponse.json({ status: 'ok' })
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('seating_enabled, table_count, seats_per_table')
    .eq('id', eventId)
    .maybeSingle()
  if (!event?.seating_enabled) return NextResponse.json({ status: 'ok' })

  const { data: regs, error } = await supabaseAdmin
    .from('event_registrations')
    .select('id, quantity, seating_code')
    .eq('event_id', eventId)
    .eq('status', 'paid')
  // A failed read must not turn into a scary warning, or a false all-clear
  // that matters more: say nothing and let the booking go ahead as normal.
  if (error) return NextResponse.json({ status: 'ok' })

  // One party per table code; a booking with no code is a party of its own.
  const parties = new Map<string, number>()
  for (const r of regs || []) {
    const key = r.seating_code || `_solo_${r.id}`
    parties.set(key, (parties.get(key) || 0) + (Number(r.quantity) || 1))
  }

  const status = partyFit(Array.from(parties.values()), party, event.table_count, event.seats_per_table)
  return NextResponse.json({ status: status ?? 'ok' })
}
