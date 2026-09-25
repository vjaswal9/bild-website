import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
// Reads every booking across every upcoming event before it can answer.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const cookieOk = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
  const cronSecret = process.env.CRON_SECRET
  const cronOk = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret
  if (!cookieOk && !cronOk) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('title, slug')
    .eq('id', eventId)
    .maybeSingle()

  const { data } = await supabaseAdmin
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'paid')
    .order('last_name', { ascending: true })

  const regs = data || []

  const dietaryLabel = (d: unknown, note?: unknown) => {
    const v = typeof d === 'string' ? d : ''
    const n = typeof note === 'string' ? note.trim() : ''
    if (v === 'vegetarian') return 'Vegetarian'
    if (v === 'vegan') return 'Vegan'
    if (v === 'other') return n ? `Other: ${n}` : 'Other'
    return ''
  }

  // Door list - one row per attendee, kept to just what door staff need:
  // name, phone, ticket type, and dietary requirement. Each booking expands
  // into the primary buyer plus a row for every named guest on the extra tickets.
  const rows: Record<string, unknown>[] = []
  regs.forEach((r: Record<string, unknown>) => {
    const buyer = `${r.first_name} ${r.last_name}`.trim()
    rows.push({
      Name: buyer,
      Phone: r.phone || '',
      'Ticket type': r.ticket_name || '',
      // Blank on every adult ticket. Only child tickets are asked for an age.
      Age: r.attendee_age ?? '',
      Dietary: dietaryLabel(r.dietary, r.dietary_note),
    })
    const guests = Array.isArray(r.guest_names) ? r.guest_names : []
    guests.forEach((g: unknown) => {
      // Guests are stored as { name, ticket_name, dietary, dietary_note } objects (older rows may be plain strings).
      const name = typeof g === 'string' ? g : ((g as { name?: string })?.name || '')
      const pkg = typeof g === 'string' ? (r.ticket_name || '') : ((g as { ticket_name?: string })?.ticket_name || '')
      const dietary = typeof g === 'string' ? '' : dietaryLabel((g as { dietary?: string })?.dietary, (g as { dietary_note?: string })?.dietary_note)
      const age = typeof g === 'string' ? '' : ((g as { age?: number })?.age ?? '')
      if (!name) return
      rows.push({
        Name: name,
        Phone: '',
        'Ticket type': pkg,
        Age: age,
        Dietary: dietary,
      })
    })
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Door List')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const name = (event as { slug?: string })?.slug || 'event'
  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="BILD-doorlist-${name}-${today}.xlsx"`,
    },
  })
}
