import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SITE_CONFIG } from '@/data/config'
import { alreadyUsedPage, expiredPage, invalidPage, notPaidPage, groupNotConfiguredPage } from '@/lib/invite-pages'

export const dynamic = 'force-dynamic'

// Reached only by an actual click on the "Join your BILD WhatsApp group"
// button on the /j/[token] confirmation page - this is what actually
// consumes the single-use invite, kept separate from that page's own load
// so an email security scanner pre-fetching the emailed link can't burn it.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, gender, status, invite_used_at, invite_expires_at')
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

  await supabaseAdmin.from('members').update({ invite_used_at: new Date().toISOString() }).eq('id', member.id)

  const link = member.gender === 'female' ? SITE_CONFIG.whatsappGroupFemale : SITE_CONFIG.whatsappGroupMale

  if (!link || link.startsWith('REPLACE_ME')) {
    return groupNotConfiguredPage()
  }

  return NextResponse.redirect(link)
}
