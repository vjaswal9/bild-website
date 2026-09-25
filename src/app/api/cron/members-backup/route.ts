import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { buildMembersWorkbook } from '@/lib/members-export'
import { buildEventsWorkbook } from '@/lib/events-export'

export const dynamic = 'force-dynamic'
// Builds two spreadsheets and emails them with both attached. The
// default function timeout is far too short for that once the membership
// grows, and a backup cut off half way is no backup at all.
export const maxDuration = 300

// Weekly backup: builds the members Excel and the upcoming-events Excel and
// emails both to the admin list. The events file carries every booking plus a
// door list per event, so the night can still be run if the database is lost.
// Triggered by Vercel Cron (Authorization: Bearer CRON_SECRET) or manually
// with the x-cron-secret header.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    !!secret &&
    (req.headers.get('authorization') === `Bearer ${secret}` ||
      req.headers.get('x-cron-secret') === secret)
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  const recipients = (process.env.ADMIN_ALERT_EMAIL || 'connect@bild.ae')
    .split(',').map(s => s.trim()).filter(Boolean)

  const { buffer, count } = await buildMembersWorkbook()
  // A failure to build the events file must not cost you the members backup,
  // which is the half that has been running reliably for months.
  let events: Awaited<ReturnType<typeof buildEventsWorkbook>> | null = null
  let eventsError: string | null = null
  try {
    events = await buildEventsWorkbook()
  } catch (e) {
    eventsError = e instanceof Error ? e.message : 'Could not build the events backup.'
    console.error('Events backup failed:', e)
  }
  const today = new Date().toISOString().slice(0, 10)
  const filename = `BILD-members-${today}.xlsx`
  const eventsFilename = `BILD-events-and-door-lists-${today}.xlsx`

  const resend = new Resend(apiKey)
  const r = await resend.emails.send({
    from: process.env.RESEND_FROM || 'BILD <connect@bild.ae>',
    to: recipients,
    subject: `BILD weekly backup (${count} members, ${events ? `${events.events} upcoming events` : 'events file failed'})`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#0E0E0E;font-size:18px;margin:0 0 8px">📋 Weekly backup</h2>
        <p style="color:#555;font-size:14px;line-height:1.6">
          <strong>Members.</strong> ${count} record${count === 1 ? '' : 's'} as of ${today}.
          The live list is always in the admin at bild.ae/admin/members.
        </p>
        ${events ? `
        <p style="color:#555;font-size:14px;line-height:1.6">
          <strong>Events and door lists.</strong> ${events.events} upcoming event${events.events === 1 ? '' : 's'},
          ${events.bookings} booking${events.bookings === 1 ? '' : 's'} and ${events.attendees}
          name${events.attendees === 1 ? '' : 's'} on the door. The second file has a sheet of every booking, then one
          door list per event in the same layout as the download button in the admin.
        </p>` : `
        <p style="color:#9B2226;font-size:14px;line-height:1.6">
          <strong>The events and door list backup could not be built this week.</strong> ${eventsError}
          The members file above is unaffected.
        </p>`}
        <p style="color:#999;font-size:12px;margin-top:14px">
          This email contains member personal data. Please store it securely.
        </p>
      </div>`,
    attachments: [
      { filename, content: buffer.toString('base64') },
      ...(events ? [{ filename: eventsFilename, content: events.buffer.toString('base64') }] : []),
    ],
  })

  if (r.error) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    count,
    events: events ? { events: events.events, bookings: events.bookings, attendees: events.attendees } : null,
    eventsError,
    sentTo: recipients.length,
    id: r.data?.id,
  })
}
