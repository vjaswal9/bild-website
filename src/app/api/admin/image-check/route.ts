import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { imageCheckConfigured } from '@/lib/image-check'

export const dynamic = 'force-dynamic'

// What the review page shows: photos waiting for a decision, plus a summary.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: flagged, error } = await supabaseAdmin
    .from('image_checks')
    .select('id, url, source, ref_label, regions, reason')
    .eq('status', 'flagged')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts: Record<string, number> = {}
  for (const status of ['pending', 'clear', 'flagged', 'blurred', 'kept', 'error']) {
    const { count } = await supabaseAdmin.from('image_checks').select('id', { count: 'exact', head: true }).eq('status', status)
    counts[status] = count || 0
  }

  return NextResponse.json({ configured: imageCheckConfigured(), flagged: flagged || [], counts })
}
