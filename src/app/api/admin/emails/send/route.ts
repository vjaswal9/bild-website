import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { sendComposedEventEmail, eventsAlertRecipients } from '@/lib/email'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'

export const dynamic = 'force-dynamic'

// Sends a one-off message from the events inbox.
//
// Everything else BILD sends is triggered by something happening: a sale, a
// refund, an expiry. This is for the times when a person needs writing to and
// no automated email covers it, for example telling members a booking fault
// has been fixed. Going out through Resend rather than someone's own mail
// client keeps the sender, the branding and the reply address right, and
// leaves the message in the Emails tab with everything else.
const MAX_RECIPIENTS = 20

export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { to, subject, body } = await req.json().catch(() => ({}))

  const recipients = Array.isArray(to) ? to : String(to || '').split(/[,;\s]+/)
  const cleaned = Array.from(new Set(recipients.map(r => normaliseEmail(String(r))).filter(Boolean)))

  if (cleaned.length === 0) return NextResponse.json({ error: 'Add at least one recipient.' }, { status: 400 })
  if (cleaned.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `This is for a handful of people, not a mailing list. Maximum ${MAX_RECIPIENTS} recipients.` }, { status: 400 })
  }
  const bad = cleaned.filter(e => !isValidEmail(e))
  if (bad.length) return NextResponse.json({ error: `These addresses do not look valid: ${bad.join(', ')}` }, { status: 400 })

  if (!String(subject || '').trim()) return NextResponse.json({ error: 'Add a subject.' }, { status: 400 })
  if (!String(body || '').trim()) return NextResponse.json({ error: 'Add a message.' }, { status: 400 })

  // Each recipient gets their own send, so nobody sees anyone else's address.
  const bcc = eventsAlertRecipients()
  const results: { to: string; ok: boolean; error?: string }[] = []
  for (const address of cleaned) {
    const r = await sendComposedEventEmail({
      to: [address],
      subject: String(subject).trim(),
      bodyText: String(body),
      bcc,
    })
    results.push({ to: address, ok: r.ok, error: r.error })
  }

  const failed = results.filter(r => !r.ok)
  return NextResponse.json({
    sent: results.filter(r => r.ok).map(r => r.to),
    failed,
    bcc,
  }, { status: failed.length && failed.length === results.length ? 502 : 200 })
}
