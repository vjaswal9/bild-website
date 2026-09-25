import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendWaitlistOfferEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'

async function guard(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

// The queue for one event, oldest first, plus how many seats are actually free.
export async function GET(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  const [listRes, evRes, soldRes] = await Promise.all([
    supabaseAdmin
      .from('event_waitlist')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('events').select('capacity_limit, waitlist_open').eq('id', eventId).maybeSingle(),
    supabaseAdmin.from('event_registrations').select('quantity').eq('event_id', eventId).eq('status', 'paid'),
  ])

  if (listRes.error) return NextResponse.json({ error: listRes.error.message }, { status: 500 })

  const cap = (evRes.data as { capacity_limit?: number | null })?.capacity_limit ?? null
  const sold = (soldRes.data || []).reduce((s, r) => s + (Number(r.quantity) || 1), 0)

  return NextResponse.json({
    entries: listRes.data || [],
    capacityLimit: cap,
    ticketsSold: sold,
    // Seats free right now. A refund or a cancelled booking is what makes
    // this go above zero, which is the moment to offer a place.
    seatsFree: cap == null ? null : Math.max(0, cap - sold),
    waitlistOpen: (evRes.data as { waitlist_open?: boolean })?.waitlist_open !== false,
  })
}

// Offer a place, or change somebody's status.
export async function POST(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id, action, status, adminNote } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { data: entry } = await supabaseAdmin
    .from('event_waitlist')
    .select('id, event_id, first_name, email, tickets_wanted, admin_note')
    .eq('id', id)
    .maybeSingle()
  if (!entry) return NextResponse.json({ error: 'Waitlist entry not found.' }, { status: 404 })

  if (action === 'offer') {
    const { data: ev } = await supabaseAdmin
      .from('events')
      .select('title, slug, capacity_limit')
      .eq('id', entry.event_id)
      .maybeSingle()
    const { data: soldRows } = await supabaseAdmin
      .from('event_registrations')
      .select('quantity')
      .eq('event_id', entry.event_id)
      .eq('status', 'paid')
    const sold = (soldRows || []).reduce((s, r) => s + (Number(r.quantity) || 1), 0)
    const cap = (ev as { capacity_limit?: number | null })?.capacity_limit ?? null
    const free = cap == null ? null : Math.max(0, cap - sold)

    if (free === 0) {
      return NextResponse.json({
        error: 'There are no free seats to offer. Refund or cancel a booking first.',
      }, { status: 400 })
    }

    await sendWaitlistOfferEmail({
      to: entry.email,
      firstName: entry.first_name,
      eventTitle: (ev as { title?: string })?.title || 'a BILD event',
      eventUrl: `${SITE_URL}/events/${(ev as { slug?: string })?.slug || ''}`,
      ticketsAvailable: free ?? undefined,
    })

    const { error } = await supabaseAdmin
      .from('event_waitlist')
      .update({ status: 'invited', invited_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, offeredTo: entry.email })
  }

  const allowed = ['waiting', 'invited', 'converted', 'declined', 'removed']
  if (!allowed.includes(String(status))) {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('event_waitlist')
    .update({
      status,
      admin_note: adminNote ? String(adminNote).slice(0, 300) : entry.admin_note,
    })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Open or close the waitlist for an event.
export async function PATCH(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { eventId, open } = await req.json().catch(() => ({}))
  if (!eventId) return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('events')
    .update({ waitlist_open: open === true })
    .eq('id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  const { error } = await supabaseAdmin.from('event_waitlist').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
