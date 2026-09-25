import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { stripDashes } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function authed(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

// Create or update a reel.
export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const b = await req.json().catch(() => null)
  if (!b || !b.name || !b.url) {
    return NextResponse.json({ error: 'Name and Instagram URL are required.' }, { status: 400 })
  }
  if (!String(b.url).includes('instagram.com')) {
    return NextResponse.json({ error: 'Enter a valid Instagram post/reel URL.' }, { status: 400 })
  }

  const fields = {
    name: stripDashes(String(b.name).trim()),
    url: String(b.url).trim(),
    caption: b.caption ? stripDashes(String(b.caption).trim()) : null,
    active: b.active !== false,
    pinned: b.pinned === true,
  }

  if (b.id) {
    const { error } = await supabaseAdmin.from('faces_reels').update(fields).eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: b.id })
  }

  const { data, error } = await supabaseAdmin.from('faces_reels').insert([fields]).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await supabaseAdmin.from('faces_reels').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
