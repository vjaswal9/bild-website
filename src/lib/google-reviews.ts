// Server-only. Never import in client components.
// Fetches Google Reviews for the BILD business listing via the Places API
// (New). Reviews change rarely, so results are cached for 24h. Returns null
// whenever the env vars are unset or the fetch fails, so callers can simply
// skip rendering the section rather than breaking the page.

export type GoogleReview = {
  author: string
  profilePhotoUrl?: string
  rating: number
  text: string
  relativeTime: string
}

export type GoogleReviewsData = {
  rating: number
  totalReviews: number
  reviews: GoogleReview[]
  reviewUrl: string
  mapsUrl: string
}

export async function getGoogleReviews(placeId?: string): Promise<GoogleReviewsData | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const id = placeId || process.env.GOOGLE_PLACE_ID
  if (!apiKey || !id) return null

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${id}?fields=rating,userRatingCount,reviews,googleMapsUri`,
      {
        headers: { 'X-Goog-Api-Key': apiKey },
        next: { revalidate: 86400 },
      }
    )
    if (!res.ok) return null

    const data = await res.json()
    if (!data.rating) return null

    const reviews: GoogleReview[] = (data.reviews || []).map((r: Record<string, unknown>) => ({
      author: (r.authorAttribution as Record<string, unknown>)?.displayName as string || 'Anonymous',
      profilePhotoUrl: (r.authorAttribution as Record<string, unknown>)?.photoUri as string | undefined,
      rating: Number(r.rating) || 5,
      text: ((r.text as Record<string, unknown>)?.text as string) || '',
      relativeTime: (r.relativePublishTimeDescription as string) || '',
    })).filter((r: GoogleReview) => r.text.trim().length > 0)

    // A place can have a real rating with no written reviews (or only
    // untranslated ones) - still worth showing the rating/badge even when
    // `reviews` ends up empty; callers skip the carousel in that case.
    return {
      rating: Number(data.rating),
      totalReviews: Number(data.userRatingCount) || reviews.length,
      reviews,
      reviewUrl: `https://search.google.com/local/writereview?placeid=${id}`,
      mapsUrl: (data.googleMapsUri as string) || `https://www.google.com/maps/place/?q=place_id:${id}`,
    }
  } catch {
    return null
  }
}

function extractPlaceId(u: URL): string | null {
  const direct = u.searchParams.get('placeid') || u.searchParams.get('place_id')
  if (direct) return direct

  // Signed-out requests get redirected to a Google sign-in interstitial with
  // the real destination (and its placeid) URL-encoded inside `continue=`.
  const cont = u.searchParams.get('continue')
  if (cont) {
    try {
      return extractPlaceId(new URL(cont))
    } catch {
      return null
    }
  }
  return null
}

// Resolves a Google Place ID from a business's own review/Maps link. Regular
// Maps URLs and name-based Places API search proved unreliable (this is the
// same "share link → follow redirect → extract placeid" technique that
// resolved BILD's own Place ID) - the reliable input is specifically a
// Google Business Profile "Get more reviews" share link (g.page/r/.../review),
// which redirects to a URL containing `placeid=` (sometimes nested inside a
// sign-in interstitial's `continue=` param).
export async function resolvePlaceIdFromGoogleUrl(url: string): Promise<string | null> {
  try {
    const direct = extractPlaceId(new URL(url))
    if (direct) return direct

    const res = await fetch(url, { redirect: 'follow' })
    return extractPlaceId(new URL(res.url))
  } catch {
    return null
  }
}
