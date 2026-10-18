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

// A permit number as typed: letters, digits and the separators permit numbers
// use. Anything else is refused rather than quietly altered, because the value
// is printed on the public event page.
const PERMIT_MAX = 60
function cleanPermit(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const s = stripDashes(String(v ?? '')).replace(/\s+/g, ' ').trim()
  if (!s) return { ok: true, value: null }
  if (s.length > PERMIT_MAX) return { ok: false, error: `The permit number is too long (${PERMIT_MAX} characters at most).` }
  if (!/^[A-Za-z0-9 \-/.#(),]+$/.test(s)) {
    return { ok: false, error: 'The permit number can only contain letters, numbers, spaces and - / . # ( ) ,' }
  }
  return { ok: true, value: s }
}

// True when the database does not have the permit_number column yet.
function permitColumnMissing(err: { code?: string; message?: string } | null) {
  return !!err && (err.code === '42703' || err.code === 'PGRST204' || /permit_number/.test(err.message || ''))
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
    seating_enabled: b.seating_enabled === true,
    table_count: b.seating_enabled === true && b.table_count != null && b.table_count !== '' ? Math.max(1, Math.round(Number(b.table_count))) : null,
    seats_per_table: b.seating_enabled === true && b.seats_per_table != null && b.seats_per_table !== '' ? Math.max(1, Math.round(Number(b.seats_per_table))) : null,
  }

  // The permit number is only touched when the form sends it, so anything that
  // saves an event without it (an older tab, another tool) never wipes it.
  let permit: string | null | undefined
  if (b.permit_number !== undefined) {
    const p = cleanPermit(b.permit_number)
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 })
    permit = p.value
  }

  if (b.id) {
    let permitNotSaved = false
    let { error } = await supabaseAdmin.from('events').update(permit === undefined ? fields : { ...fields, permit_number: permit }).eq('id', b.id)
    // Before the one-off SQL has been run there is no column to write to. The
    // rest of the event must still save, so try again without it and say so.
    if (error && permit !== undefined && permitColumnMissing(error)) {
      permitNotSaved = true
      ;({ error } = await supabaseAdmin.from('events').update(fields).eq('id', b.id))
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revalidatePublic(EVENT_PATHS)
    return NextResponse.json({ ok: true, id: b.id, ...(permitNotSaved ? { permitNotSaved: true } : {}) })
  }

  // New event - generate a unique slug.
  let slug = slugify(b.title)
  const { data: existing } = await supabaseAdmin.from('events').select('id').eq('slug', slug).maybeSingle()
  if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  let permitNotSaved = false
  let created = await supabaseAdmin
    .from('events')
    .insert([permit === undefined || permit === null ? { ...fields, slug } : { ...fields, slug, permit_number: permit }])
    .select('id')
    .single()
  if (created.error && permit && permitColumnMissing(created.error)) {
    permitNotSaved = true
    created = await supabaseAdmin.from('events').insert([{ ...fields, slug }]).select('id').single()
  }

  if (created.error || !created.data) return NextResponse.json({ error: created.error?.message || 'Could not create the event.' }, { status: 500 })
  revalidatePublic(EVENT_PATHS)
  return NextResponse.json({ ok: true, id: created.data.id, ...(permitNotSaved ? { permitNotSaved: true } : {}) })
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
