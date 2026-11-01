import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { oneOf, uuid } from '@/lib/validate'
import { ADMIN_MEMO_MAX, cleanAdminMemo, memoLength } from '@/lib/admin-memo'

export const dynamic = 'force-dynamic'

const TABLES = { booking: 'event_registrations', waitlist: 'event_waitlist' } as const

// Admin only: set or clear the short private memo on a booking or a
// waiting-list entry. Nothing outside the admin area ever reads it back.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const kind = oneOf<'booking' | 'waitlist' | ''>(b.kind, ['booking', 'waitlist'], '')
  const table = kind ? TABLES[kind] : null
  const id = uuid(b.id)
  if (!table || !id) return NextResponse.json({ error: 'Missing or unknown entry.' }, { status: 400 })

  if (typeof b.memo !== 'string' && b.memo !== null) {
    return NextResponse.json({ error: 'The note must be text.' }, { status: 400 })
  }
  const memo = cleanAdminMemo(b.memo)
  if (memo && memoLength(memo) > ADMIN_MEMO_MAX) {
    return NextResponse.json({ error: `Keep the note to ${ADMIN_MEMO_MAX} characters.` }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .update({ admin_memo: memo })
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not save the note.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'That entry no longer exists.' }, { status: 404 })

  return NextResponse.json({ ok: true, memo })
}
