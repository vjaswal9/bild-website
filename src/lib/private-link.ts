// Personal, single-use links to a partner's private ticket page.
//
// Tickets for some events are sold by a partner (Ticketsfy) through one private
// address, which anyone who receives it can forward. So each person the admin
// picks (waiting list or VIP) is sent their own BILD link (/t/<token>) instead. It works
// once and expires, and only then sends them on to the partner's page.
import { randomUUID } from 'crypto'
import type { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { invitePage } from '@/lib/invite-pages'
import { dubaiWhen } from '@/lib/private-link-format'

export const PRIVATE_LINK_DEFAULT_HOURS = 48
export const PRIVATE_LINK_MAX_HOURS = 24 * 14

export const isToken = (t: string) => /^[a-f0-9]{32}$/.test(t)
export const newToken = () => randomUUID().replace(/-/g, '')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export { inviteMessage, whatsappDigits } from '@/lib/private-link-format'

const LINK = { ctaColor: '#C8861A', contactEmail: 'events@bild.ae' }

const invalidLink = () =>
  invitePage({
    ...LINK,
    title: 'We do not recognise this link',
    tone: 'problem',
    lead: 'This is not a link we issued, or it has been replaced by a newer one.',
    detail: 'Please use the most recent message from BILD Events. If it still does not work, email events@bild.ae.',
  })

const usedLink = () =>
  invitePage({
    ...LINK,
    title: 'This link has already been used',
    lead: 'Each personal link works once, so it stops working as soon as it is opened.',
    detail:
      '<strong>If you reached the Ticketsfy page:</strong> go back to it from your browser history and finish booking there. ' +
      '<br><br><strong>If something went wrong:</strong> email events@bild.ae and we will look into it.',
  })

const expiredLink = () =>
  invitePage({
    ...LINK,
    title: 'This link has expired',
    lead: 'Personal links are only valid for a limited time, and this one has passed that.',
    detail: 'If you still want a ticket, email events@bild.ae and we will tell you whether a place is still available.',
  })

const unavailableLink = () =>
  invitePage({
    ...LINK,
    title: 'This link is not available',
    lead: 'We cannot open this link right now.',
    detail: 'Please email events@bild.ae and we will sort it out.',
  })

type Found = {
  id: string
  eventTitle: string
  ticketUrl: string
  expiresAt: string
}

// Looks the link up and checks it can still be used. Never changes anything.
export async function checkPrivateLink(token: string): Promise<{ page: NextResponse } | { found: Found }> {
  if (!isToken(token)) return { page: invalidLink() }

  const { data: link } = await supabaseAdmin
    .from('event_private_links')
    .select('id, event_id, expires_at, used_at, revoked_at')
    .eq('token', token)
    .maybeSingle()
  if (!link) return { page: invalidLink() }
  if (link.revoked_at) return { page: unavailableLink() }
  if (link.used_at) return { page: usedLink() }
  if (new Date(link.expires_at) < new Date()) return { page: expiredLink() }

  const { data: ev } = await supabaseAdmin
    .from('events')
    .select('title, private_ticket_url')
    .eq('id', link.event_id)
    .maybeSingle()
  const ticketUrl = (ev as { private_ticket_url?: string | null } | null)?.private_ticket_url
  if (!ticketUrl) return { page: unavailableLink() }

  return {
    found: {
      id: link.id,
      eventTitle: (ev as { title?: string })?.title || 'this BILD event',
      ticketUrl,
      expiresAt: link.expires_at,
    },
  }
}

export function readyPage(token: string, f: Found) {
  return invitePage({
    ...LINK,
    title: 'Your ticket link is ready',
    tone: 'good',
    lead:
      `This is your personal link to buy a ticket for <strong>${esc(f.eventTitle)}</strong>, ` +
      'sold through our official ticketing partner, Ticketsfy.',
    cta: { href: `/t/${token}/go`, label: 'Get my ticket' },
    detail:
      'This link is for you only and works <strong>once</strong>: it stops working as soon as you tap the button, ' +
      'so only tap it when you are ready to buy.' +
      ` It is valid until ${esc(dubaiWhen(f.expiresAt))} (Dubai time).`,
    showContact: false,
  })
}

export const claimedAlready = usedLink
