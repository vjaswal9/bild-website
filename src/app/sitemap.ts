import type { MetadataRoute } from 'next'
import { LAUNCH_MODE, isLivePath } from '@/lib/launch'
import { getPublishedEvents } from '@/lib/events-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BASE = 'https://www.bild.ae'

// All public pages; during soft launch only the live ones are listed.
const ALL_PAGES: { path: string; priority: number; lastModified: Date }[] = [
  { path: '/', priority: 1, lastModified: new Date('2026-07-01') },
  { path: '/join', priority: 0.9, lastModified: new Date('2026-07-01') },
  { path: '/about', priority: 0.8, lastModified: new Date('2026-07-01') },
  { path: '/events', priority: 0.8, lastModified: new Date('2026-07-01') },
  { path: '/directory', priority: 0.7, lastModified: new Date('2026-07-01') },
  { path: '/knowledge-base', priority: 0.7, lastModified: new Date('2026-07-01') },
  { path: '/photo-vault', priority: 0.5, lastModified: new Date('2026-07-01') },
  { path: '/faces-of-bild', priority: 0.5, lastModified: new Date('2026-07-01') },
  { path: '/testimonials', priority: 0.5, lastModified: new Date('2026-08-31') },
  { path: '/community-rules', priority: 0.4, lastModified: new Date('2026-07-01') },
  { path: '/contact', priority: 0.6, lastModified: new Date('2026-09-11') },
  { path: '/terms', priority: 0.4, lastModified: new Date('2026-07-01') },
  { path: '/privacy', priority: 0.4, lastModified: new Date('2026-09-09') },
  { path: '/refund-policy', priority: 0.4, lastModified: new Date('2026-09-09') },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = ALL_PAGES
    .filter(p => !LAUNCH_MODE || isLivePath(p.path))
    .map(p => ({
      url: `${BASE}${p.path === '/' ? '' : p.path}`,
      lastModified: p.lastModified,
      changeFrequency: 'weekly' as const,
      priority: p.priority,
    }))

  let entries = [...staticEntries]

  if (!LAUNCH_MODE || isLivePath('/events')) {
    const events = await getPublishedEvents()
    entries = entries.concat(events.map(event => ({
      url: `${BASE}/events/${event.slug}`,
      lastModified: new Date(event.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })))
  }

  if (!LAUNCH_MODE || isLivePath('/directory')) {
    // Every publicly visible business listing - same approval + listing-fee
    // gate used by the directory pages themselves, so the sitemap never
    // links to a business a visitor would just get a 404/hidden page from.
    const nowIso = new Date().toISOString()
    const { data: businesses } = await supabaseAdmin
      .from('business_submissions')
      .select('slug, reviewed_at, created_at')
      .eq('status', 'approved')
      .is('delisted_at', null)
      .not('slug', 'is', null)
      .or(`listing_fee_exempt.eq.true,listing_paid_until.gte.${nowIso}`)

    entries = entries.concat((businesses || []).map(b => ({
      url: `${BASE}/directory/${b.slug}`,
      lastModified: new Date(b.reviewed_at || b.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })))
  }

  return entries
}
