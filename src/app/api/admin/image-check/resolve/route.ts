import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { applyBlur, ImageCheckRow } from '@/lib/image-check'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// An admin's decision on one flagged photo: blur the ticked areas, or keep it
// exactly as it is.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, action, regionIndexes } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || (action !== 'blur' && action !== 'keep')) {
    return NextResponse.json({ error: 'Missing id or action.' }, { status: 400 })
  }

  const { data: row } = await supabaseAdmin.from('image_checks').select('*').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
  if (row.status !== 'flagged') {
    return NextResponse.json({ error: 'This photo has already been dealt with.' }, { status: 409 })
  }

  if (action === 'keep') {
    await supabaseAdmin.from('image_checks').update({ status: 'kept', reviewed_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  const all = (row as ImageCheckRow).regions || []
  const picked = Array.isArray(regionIndexes)
    ? regionIndexes.filter((i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < all.length).map((i: number) => all[i])
    : []
  try {
    await applyBlur(row as ImageCheckRow, picked)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not blur this photo.' }, { status: 400 })
  }
}
