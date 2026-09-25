import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const EDITABLE = ['full_name', 'email', 'phone', 'gender', 'location', 'status'] as const

export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body || !body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const update: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (key in body) update[key] = typeof body[key] === 'string' ? body[key].trim() : body[key]
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { error } = await supabaseAdmin.from('members').update(update).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
