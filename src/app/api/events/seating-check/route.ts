import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { findSeatingGroupOrganiser } from '@/lib/seating-code'

export const dynamic = 'force-dynamic'

// "Is this a real table code?" - checked live as someone types it into the
// booking form, so a typo is caught before payment rather than discovered by
// the admin team a day before the event when a "group" turns out to be one
// person who never actually joined anyone.
//
// Read-only, so a wrong guess costs the guesser nothing; rate limited anyway,
// because it is public and unauthenticated.
export async function GET(req: NextRequest) {
  if (isRateLimited(`seating-check:${getClientIp(req)}`, { windowMs: 60 * 1000, max: 30 })) {
    return NextResponse.json({ found: false })
  }

  const eventId = req.nextUrl.searchParams.get('eventId') || ''
  const code = req.nextUrl.searchParams.get('code') || ''
  if (!eventId || !code) return NextResponse.json({ found: false })

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('seating_enabled, seats_per_table')
    .eq('id', eventId)
    .maybeSingle()
  if (!event?.seating_enabled) return NextResponse.json({ found: false })

  const result = await findSeatingGroupOrganiser(eventId, code)
  // seatsPerTable travels alongside the headcount so the booking form can say
  // "6 of 10 seats already claimed" - only meaningful once an admin has set a
  // table size, so it is simply absent until then rather than shown as 0.
  return NextResponse.json({ ...result, seatsPerTable: event.seats_per_table ?? null })
}
