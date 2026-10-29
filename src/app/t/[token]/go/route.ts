import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkPrivateLink, claimedAlready } from '@/lib/private-link'

export const dynamic = 'force-dynamic'

// Reached only by tapping the button on /t/<token>. This is what uses the link
// up, and it does so in a single update that only succeeds while the link is
// still unused, so two taps at once cannot both get through.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await checkPrivateLink(token)
  if ('page' in r) return r.page

  const { data: claimed } = await supabaseAdmin
    .from('event_private_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', r.found.id)
    .is('used_at', null)
    .select('id')
  if (!claimed || claimed.length === 0) return claimedAlready()

  return NextResponse.redirect(r.found.ticketUrl)
}
