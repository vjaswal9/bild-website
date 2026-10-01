import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { buildMembersWorkbook } from '@/lib/members-export'
import { buildEventsWorkbook } from '@/lib/events-export'
import { buildBusinessDirectoryWorkbook } from '@/lib/business-directory-export'
import { buildFinancialWorkbook } from '@/lib/financial-export'

export const dynamic = 'force-dynamic'
// Builds four spreadsheets and emails them all attached. The
// default function timeout is far too short for that once the membership
// grows, and a backup cut off half way is no backup at all.
export const maxDuration = 300

// Weekly backup: builds the members, upcoming-events, business-directory and
// financial-ledger spreadsheets and emails all four to the admin list. This is
// the one copy of BILD's data that lives entirely outside Supabase/Vercel -
// in the admin's own inbox - so the site can still be run and the books still
// make sense even if every cloud account behind it became unreachable at once.
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

  // This is the one copy of BILD's data meant to survive losing every cloud
  // account at once, so it always reaches the owner personally - not only
  // whatever shared inbox ADMIN_ALERT_EMAIL happens to point at.
  const adminList = (process.env.ADMIN_ALERT_EMAIL || 'connect@bild.ae')
    .split(',').map(s => s.trim()).filter(Boolean)
  const ownerList = (process.env.OWNER_ALERT_EMAIL || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const recipients = Array.from(new Set([...adminList, ...ownerList]))

  // The members file has been running reliably for months - it still goes out
  // even if everything added after it fails to build.
  const { buffer, count } = await buildMembersWorkbook()

  let events: Awaited<ReturnType<typeof buildEventsWorkbook>> | null = null
  let eventsError: string | null = null
  try {
    events = await buildEventsWorkbook()
  } catch (e) {
    eventsError = e instanceof Error ? e.message : 'Could not build the events backup.'
    console.error('Events backup failed:', e)
  }

  let directory: Awaited<ReturnType<typeof buildBusinessDirectoryWorkbook>> | null = null
  let directoryError: string | null = null
  try {
    directory = await buildBusinessDirectoryWorkbook()
  } catch (e) {
    directoryError = e instanceof Error ? e.message : 'Could not build the business directory backup.'
    console.error('Business directory backup failed:', e)
  }

  let financial: Awaited<ReturnType<typeof buildFinancialWorkbook>> | null = null
  let financialError: string | null = null
  try {
    financial = await buildFinancialWorkbook()
  } catch (e) {
    financialError = e instanceof Error ? e.message : 'Could not build the financial ledger backup.'
    console.error('Financial ledger backup failed:', e)
  }

  const today = new Date().toISOString().slice(0, 10)
  const filename = `BILD-members-${today}.xlsx`
  const eventsFilename = `BILD-events-and-door-lists-${today}.xlsx`
  const directoryFilename = `BILD-business-directory-${today}.xlsx`
  const financialFilename = `BILD-financial-ledger-${today}.xlsx`

  const resend = new Resend(apiKey)
  const r = await resend.emails.send({
    from: process.env.RESEND_FROM || 'BILD <connect@bild.ae>',
    to: recipients,
    subject: `BILD weekly backup (${count} members, ${events ? `${events.events} events` : 'events failed'}, `
      + `${directory ? `${directory.count} businesses` : 'directory failed'}, `
      + `${financial ? `${financial.payments} payments` : 'ledger failed'})`,
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
          name${events.attendees === 1 ? '' : 's'} on the door. The file has a sheet of every booking, then one
          door list per event in the same layout as the download button in the admin.
        </p>` : `
        <p style="color:#9B2226;font-size:14px;line-height:1.6">
          <strong>The events and door list backup could not be built this week.</strong> ${eventsError}
        </p>`}
        ${directory ? `
        <p style="color:#555;font-size:14px;line-height:1.6">
          <strong>Business directory.</strong> ${directory.count} listing${directory.count === 1 ? '' : 's'}
          ever submitted, whatever their current status.
        </p>` : `
        <p style="color:#9B2226;font-size:14px;line-height:1.6">
          <strong>The business directory backup could not be built this week.</strong> ${directoryError}
        </p>`}
        ${financial ? `
        <p style="color:#555;font-size:14px;line-height:1.6">
          <strong>Financial ledger.</strong> ${financial.payments} payment${financial.payments === 1 ? '' : 's'} and
          ${financial.costs} operating cost${financial.costs === 1 ? '' : 's'} recorded to date - the same rows the
          Money dashboard reads.
        </p>` : `
        <p style="color:#9B2226;font-size:14px;line-height:1.6">
          <strong>The financial ledger backup could not be built this week.</strong> ${financialError}
        </p>`}
        <p style="color:#999;font-size:12px;margin-top:14px">
          These files contain personal and financial data. Please store them securely, and delete old copies you no
          longer need.
        </p>
      </div>`,
    attachments: [
      { filename, content: buffer.toString('base64') },
      ...(events ? [{ filename: eventsFilename, content: events.buffer.toString('base64') }] : []),
      ...(directory ? [{ filename: directoryFilename, content: directory.buffer.toString('base64') }] : []),
      ...(financial ? [{ filename: financialFilename, content: financial.buffer.toString('base64') }] : []),
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
    directory: directory ? { count: directory.count } : null,
    directoryError,
    financial: financial ? { payments: financial.payments, costs: financial.costs } : null,
    financialError,
    sentTo: recipients.length,
    id: r.data?.id,
  })
}
