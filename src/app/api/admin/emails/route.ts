import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
// The Resend library reads the email list with a plain fetch. Next.js stores
// plain fetches in its data cache, which outlives deployments, so without this
// the tab kept replaying the list as it stood on 13 September and Refresh
// changed nothing. Every admin page already sets this for the same reason.
export const fetchCache = 'force-no-store'

// Reads the sent-email log straight from Resend rather than keeping a copy.
//
// Resend is the system of record here: it knows what was actually delivered,
// bounced or opened, which a log written at send time cannot. Mirroring it
// into our own table would drift the moment an email bounced an hour later.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Email is not configured on this server (RESEND_API_KEY is not set).' },
      { status: 503 },
    )
  }
  const resend = new Resend(apiKey)

  // A single email, with its body, for the detail view.
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    try {
      const { data, error } = await resend.emails.get(id)
      if (error) return NextResponse.json({ error: error.message }, { status: 502 })
      return NextResponse.json({ email: data })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load the email.' }, { status: 502 })
    }
  }

  const limitParam = Number(req.nextUrl.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50
  const after = req.nextUrl.searchParams.get('after') || undefined

  try {
    const { data, error } = await resend.emails.list(after ? { limit, after } : { limit })
    if (error) return NextResponse.json({ error: error.message }, { status: 502 })

    const rows = (data?.data || []).map(e => ({
      id: e.id,
      to: e.to || [],
      cc: e.cc || [],
      bcc: e.bcc || [],
      from: e.from,
      subject: e.subject,
      status: e.last_event,
      createdAt: e.created_at,
    }))

    return NextResponse.json({
      emails: rows,
      hasMore: !!data?.has_more,
      // The cursor for the next page is the last id on this one.
      nextCursor: rows.length ? rows[rows.length - 1].id : null,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load emails.' }, { status: 502 })
  }
}
