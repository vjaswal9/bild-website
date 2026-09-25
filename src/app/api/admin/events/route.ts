import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { stripDashes } from '@/lib/utils'
import { revalidatePublic, EVENT_PATHS } from '@/lib/revalidate-public'

export const dynamic = 'force-dynamic'

function authed(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'event'
}

// Create or update an event.
export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const b = await req.json().catch(() => null)
  if (!b || !b.title || !b.event_date) {
    return NextResponse.json({ error: 'Title and date are required.' }, { status: 400 })
  }

  const tags = typeof b.tags === 'string'
    ? b.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : Array.isArray(b.tags) ? b.tags : []

  const fields = {
    title: stripDashes(String(b.title).trim()),
    description: stripDashes(b.description ?? ''),
    venue: stripDashes(b.venue ?? ''),
    location: stripDashes(b.location ?? ''),
    google_maps_url: b.google_maps_url ? String(b.google_maps_url).trim() : null,
    flyer_url: b.flyer_url || null,
    event_date: b.event_date,
    end_date: b.end_date || null,
    status: b.status === 'published' ? 'published' : 'draft',
    tags,
    capacity_limit: b.capacity_limit != null && b.capacity_limit !== '' ? Math.max(0, Math.round(Number(b.capacity_limit))) : null,
    dietary_required: b.dietary_required === true,
  }

  if (b.id) {
    const { error } = await supabaseAdmin.from('events').update(fields).eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revalidatePublic(EVENT_PATHS)
    return NextResponse.json({ ok: true, id: b.id })
  }

  // New event - generate a unique slug.
  let slug = slugify(b.title)
  const { data: existing } = await supabaseAdmin.from('events').select('id').eq('slug', slug).maybeSingle()
  if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert([{ ...fields, slug }])
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublic(EVENT_PATHS)
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id, password } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  // Deleting an event is destructive - re-confirm the admin password.
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password. Event was not deleted.' }, { status: 401 })
  }
  const { error } = await supabaseAdmin.from('events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublic(EVENT_PATHS)
  return NextResponse.json({ ok: true })
}
