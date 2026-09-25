import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { invitePage, alreadyUsedPage, expiredPage, invalidPage, notPaidPage } from '@/lib/invite-pages'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, status, invite_used_at, invite_opened_at, invite_expires_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!member) {
    return invalidPage()
  }
  if (member.status !== 'paid') {
    return notPaidPage()
  }
  if (member.invite_used_at) {
    return alreadyUsedPage()
  }
  if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
    return expiredPage()
  }

  // Record the first time this page loaded, without consuming the invite -
  // some email providers (e.g. Outlook/Hotmail's Safe Links) automatically
  // pre-fetch every link in an incoming email to scan it for malware. If we
  // marked the invite used here, that automated scan alone would silently
  // burn it before the real recipient ever saw the email. Only the button
  // click below (a separate URL a scanner won't follow) marks it used.
  if (!member.invite_opened_at) {
    await supabaseAdmin.from('members').update({ invite_opened_at: new Date().toISOString() }).eq('id', member.id)
  }

  return invitePage({
    title: "You're in! 🎉",
    tone: 'good',
    lead: 'Your BILD membership is confirmed. Tap below and WhatsApp will take it from there.',
    cta: { href: `/j/${token}/confirm`, label: 'Join the BILD WhatsApp community' },
    detail:
      'After you tap, WhatsApp asks you to send a join request. An admin approves every person by hand, ' +
      'which can take up to 48 hours. This link then stops working, which is meant to happen.',
    showContact: false,
  })
}
