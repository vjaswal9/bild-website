import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkPrivateLink, readyPage } from '@/lib/private-link'

export const dynamic = 'force-dynamic'

// The page a guest lands on from their personal link. Loading it
// does not use the link up: email and chat apps open links in advance to
// preview or scan them, which would burn it before the guest ever saw it. Only
// the button, which goes to /t/<token>/go, uses it.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await checkPrivateLink(token)
  if ('page' in r) return r.page

  // First time it was looked at, for the admin's information only.
  await supabaseAdmin
    .from('event_private_links')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', r.found.id)
    .is('opened_at', null)

  return readyPage(token, r.found)
}
