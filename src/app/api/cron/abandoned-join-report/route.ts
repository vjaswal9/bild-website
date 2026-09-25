import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendAbandonedJoinWeeklyReport } from '@/lib/email'
import { recoveryOf, describeRecovery } from '@/lib/member-recovery'

export const dynamic = 'force-dynamic'

// Weekly digest of everyone who has started but never completed a BILD
// membership signup - i.e. every `members` row still stuck at status
// 'pending' (captured as early as the eligibility step in JoinForm, not
// just people who reached Stripe checkout). Triggered by Vercel Cron
// (Authorization: Bearer CRON_SECRET) or manually with the x-cron-secret
// header.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data } = await supabaseAdmin
    .from('members')
    .select('full_name, email, phone, created_at, details')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const rows = (data || []).map(m => {
    const details = (m.details as Record<string, string>) || {}
    return {
      fullName: m.full_name,
      email: m.email,
      phone: m.phone || details.uaeMobile,
      startedAt: m.created_at,
    }
  })

  // Recovered sign-ups: people who left without paying and came back later.
  // Worked out with the same rule the Members page uses.
  const { data: paidMembers } = await supabaseAdmin
    .from('members')
    .select('full_name, status, created_at, paid_at, abandoned_reminder_sent_at')
    .eq('status', 'paid')
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recoveredAll = (paidMembers || [])
    .map(m => ({ m, r: recoveryOf(m) }))
    .filter(x => x.r)
  const thisWeek = recoveredAll
    .filter(x => new Date(x.m.paid_at as string).getTime() >= weekAgo)
    .sort((a, b) => new Date(b.m.paid_at as string).getTime() - new Date(a.m.paid_at as string).getTime())
    .map(x => ({
      fullName: x.m.full_name,
      startedAt: x.m.created_at,
      paidAt: x.m.paid_at as string,
      how: describeRecovery(x.r!),
    }))

  await sendAbandonedJoinWeeklyReport({ rows, recovered: { thisWeek, allTime: recoveredAll.length } })

  return NextResponse.json({ ok: true, count: rows.length, recoveredThisWeek: thisWeek.length, recoveredAllTime: recoveredAll.length })
}
