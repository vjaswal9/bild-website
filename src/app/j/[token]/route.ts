import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SITE_CONFIG } from '@/data/config'

export const dynamic = 'force-dynamic'

function page(title: string, message: string) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;background:#fdf8f0;color:#1F2937;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
    .c{max-width:420px;text-align:center}h1{font-family:Georgia,serif;color:#C8861A}a{color:#C8861A}</style></head>
    <body><div class="c"><h1>${title}</h1><p>${message}</p>
    <p><a href="mailto:connect@bild.ae">connect@bild.ae</a></p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, gender, status, invite_used_at, invite_expires_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!member) {
    return page('Invalid link', 'This invite link is not valid. Please use the link from your welcome page or email.')
  }
  if (member.status !== 'paid') {
    return page('Payment not confirmed', 'We could not confirm your membership payment for this link yet.')
  }
  if (member.invite_used_at) {
    return page('Link already used', 'This invite link has already been used. For security, each link works only once.')
  }
  if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
    return page('Link expired', 'This invite link has expired. Please contact us and we will help you join.')
  }

  // Mark used (single-use) then redirect to the correct gender group
  await supabaseAdmin.from('members').update({ invite_used_at: new Date().toISOString() }).eq('id', member.id)

  const link = member.gender === 'female' ? SITE_CONFIG.whatsappGroupFemale : SITE_CONFIG.whatsappGroupMale

  if (!link || link.startsWith('REPLACE_ME')) {
    return page('Almost there', 'Your membership is confirmed, but the group link is not set up yet. Please contact us and we will add you right away.')
  }

  return NextResponse.redirect(link)
}
