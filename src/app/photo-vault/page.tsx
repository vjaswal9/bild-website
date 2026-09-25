import type { Metadata } from 'next'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import PhotoVaultClient, { VaultItem } from './PhotoVaultClient'
import { getPublishedEvents } from '@/lib/events-server'
import { getGoogleReviews } from '@/lib/google-reviews'

export const metadata: Metadata = {
  title: 'Photo Vault',
  description: 'Browse and download photos from past BILD events for British Indians in Dubai and the UAE.',
}
// The gallery changes when an admin adds photos, not per visitor. Same reasoning as the testimonials page.
//
// force-no-store was the damaging half: it overrode the 24 hour cache on
// the Google Places call, so every visit paid for a live API round trip
// before the first byte of HTML.
export const revalidate = 300

export default async function PhotoVaultPage() {
  const events = await getPublishedEvents()

  // Newest events first; only those that actually have gallery media.
  const withMedia = [...events]
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
    .filter(e => (e.gallery || []).length > 0)

  const items: VaultItem[] = withMedia.flatMap(e =>
    (e.gallery || [])
      .filter((g): g is typeof g & { type: 'image' | 'video' } => g.type !== 'instagram')
      .map((g, i) => ({
        id: `${e.slug}-${i}`,
        url: g.url,
        type: g.type,
        eventSlug: e.slug,
        eventTitle: e.title,
      }))
  )
  const eventList = withMedia.map(e => ({ slug: e.slug, title: e.title, date: e.event_date }))

  const instagramPosts = withMedia.flatMap(e =>
    (e.gallery || [])
      .filter(g => g.type === 'instagram')
      .map((g, i) => ({ id: `${e.slug}-ig-${i}`, url: g.url, eventSlug: e.slug, eventTitle: e.title }))
  )

  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero title="Photo Vault" subtitle="Memories from BILD events and celebrations">
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>
      <PhotoVaultClient items={items} events={eventList} instagramPosts={instagramPosts} />
    </>
  )
}
