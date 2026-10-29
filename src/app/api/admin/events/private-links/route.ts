import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { inviteMessage, newToken, PRIVATE_LINK_DEFAULT_HOURS, PRIVATE_LINK_MAX_HOURS } from '@/lib/private-link'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'

async function guard(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

const expiryFrom = (hours: unknown) => {
  const h = Math.min(PRIVATE_LINK_MAX_HOURS, Math.max(1, Math.round(Number(hours) || PRIVATE_LINK_DEFAULT_HOURS)))
  return new Date(Date.now() + h * 3600 * 1000).toISOString()
}

type LinkRow = {
  id: string; created_at: string; name: string; phone: string | null; token: string
  expires_at: string; opened_at: string | null; used_at: string | null; revoked_at: string | null
}

// What the admin screen needs for one link. The message is only worth showing
// while the link can still be used.
function present(l: LinkRow, eventTitle: string) {
  const live = !l.used_at && !l.revoked_at && new Date(l.expires_at) > new Date()
  const url = `${SITE_URL}/t/${l.token}`
  return {
    id: l.id, created_at: l.created_at, name: l.name, phone: l.phone,
    expires_at: l.expires_at, opened_at: l.opened_at, used_at: l.used_at, revoked_at: l.revoked_at,
    live,
    url: live ? url : null,
    message: live ? inviteMessage({ name: l.name, eventTitle, url, expiresAt: l.expires_at }) : null,
  }
}

async function eventOf(eventId: string) {
  const { data } = await supabaseAdmin.from('events').select('title, private_ticket_url').eq('id', eventId).maybeSingle()
  return data as { title?: string; private_ticket_url?: string | null } | null
}

// Everything for one event: the partner address, the links made so far, and
// who is on the waiting list (so one can be picked instead of typed).
export async function GET(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  const [ev, linksRes, waitRes] = await Promise.all([
    eventOf(eventId),
    supabaseAdmin.from('event_private_links').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabaseAdmin.from('event_waitlist').select('id, first_name, last_name, phone, status').eq('event_id', eventId)
      .in('status', ['waiting', 'invited']).order('created_at', { ascending: true }),
  ])
  if (linksRes.error) {
    return NextResponse.json({ error: 'The database has not been updated for private links yet. Run the SQL file first.' }, { status: 500 })
  }

  const title = ev?.title || 'a BILD event'
  return NextResponse.json({
    privateTicketUrl: ev?.private_ticket_url || '',
    links: ((linksRes.data || []) as LinkRow[]).map(l => present(l, title)),
    waiting: (waitRes.data || []).map(w => ({
      id: w.id, name: `${w.first_name || ''} ${w.last_name || ''}`.trim(), phone: w.phone || '',
    })),
  })
}

// Make a personal link for one person, or renew or cancel an existing one.
// Nothing is sent: the admin sends the message by hand.
export async function POST(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  if (body.id) {
    if (body.action === 'revoke') {
      const { error } = await supabaseAdmin.from('event_private_links').update({ revoked_at: new Date().toISOString() }).eq('id', body.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'renew') {
      const { error } = await supabaseAdmin
        .from('event_private_links')
        .update({ token: newToken(), expires_at: expiryFrom(body.hours), opened_at: null, used_at: null, revoked_at: null })
        .eq('id', body.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  const { eventId, waitlistId } = body
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })
  const ev = await eventOf(eventId)
  if (!ev) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (!ev.private_ticket_url) return NextResponse.json({ error: 'Add the private ticket link for this event first.' }, { status: 400 })

  let name = String(body.name || '').trim().slice(0, 80)
  let phone = String(body.phone || '').trim().slice(0, 30)
  if (waitlistId) {
    const { data: w } = await supabaseAdmin.from('event_waitlist')
      .select('id, first_name, last_name, phone, status').eq('id', waitlistId).eq('event_id', eventId).maybeSingle()
    if (!w) return NextResponse.json({ error: 'That waitlist entry was not found.' }, { status: 404 })
    name = name || `${w.first_name || ''} ${w.last_name || ''}`.trim()
    phone = phone || w.phone || ''
    // Being sent a link is being offered a place.
    if (w.status === 'waiting') {
      await supabaseAdmin.from('event_waitlist').update({ status: 'invited', invited_at: new Date().toISOString() }).eq('id', w.id)
    }
  }
  if (!name) return NextResponse.json({ error: 'Please enter their name.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('event_private_links').insert({
    event_id: eventId, name, phone: phone || null, waitlist_id: waitlistId || null,
    token: newToken(), expires_at: expiryFrom(body.hours),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Save (or clear) the partner's private ticket page for an event.
export async function PUT(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { eventId, url } = await req.json().catch(() => ({}))
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  const clean = String(url || '').trim()
  if (clean) {
    let ok = false
    try { ok = new URL(clean).protocol === 'https:' } catch { /* not a link */ }
    if (!ok) return NextResponse.json({ error: 'That is not a valid link. It should start with https://' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('events').update({ private_ticket_url: clean || null }).eq('id', eventId)
  if (error) {
    const missing = /private_ticket_url/.test(error.message)
    return NextResponse.json(
      { error: missing ? 'The database has not been updated for this yet. Run the SQL file first.' : error.message },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  const { error } = await supabaseAdmin.from('event_private_links').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
