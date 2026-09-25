import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { revalidatePublic } from '@/lib/revalidate-public'

export const dynamic = 'force-dynamic'

// The About page timeline. Every write refreshes /about so the change is
// live straight away rather than waiting out the page's revalidate window.
const ABOUT_PATHS = ['/about']

async function guard(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

function clean(b: Record<string, unknown>) {
  return {
    year_label: String(b.yearLabel || '').trim(),
    title: String(b.title || '').trim(),
    body: String(b.body || '').trim(),
    sort_order: Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0,
    published: b.published !== false,
  }
}

export async function POST(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const row = clean(b)
  if (!row.year_label) return NextResponse.json({ error: 'Please give a year or range.' }, { status: 400 })
  if (!row.title) return NextResponse.json({ error: 'Please give the entry a title.' }, { status: 400 })

  // An id means update; no id means create.
  const id = b.id ? String(b.id) : null
  const { data, error } = id
    ? await supabaseAdmin.from('milestones').update(row).eq('id', id).select('id').single()
    : await supabaseAdmin.from('milestones').insert([row]).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublic(ABOUT_PATHS)
  return NextResponse.json({ ok: true, id: data.id })
}

// Reordering: takes the full list of ids in their new order and writes the
// positions in one pass, so two entries can never end up sharing a place.
export async function PATCH(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { ids } = await req.json().catch(() => ({}))
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Missing the new order.' }, { status: 400 })
  }

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabaseAdmin
      .from('milestones')
      .update({ sort_order: (i + 1) * 10 })
      .eq('id', String(ids[i]))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePublic(ABOUT_PATHS)
  return NextResponse.json({ ok: true })
}

// Hides or shows the whole timeline in one action. The About page renders
// nothing at all when no entry is visible, so hiding them all takes the
// section off the page without deleting anything.
export async function PUT(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { published } = await req.json().catch(() => ({}))
  const { error } = await supabaseAdmin
    .from('milestones')
    .update({ published: published === true })
    // Supabase requires a filter on an update; this one matches every row.
    .not('id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublic(ABOUT_PATHS)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('milestones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublic(ABOUT_PATHS)
  return NextResponse.json({ ok: true })
}
