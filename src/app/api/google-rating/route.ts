import { NextResponse } from 'next/server'
import { getGoogleReviews } from '@/lib/google-reviews'

export const dynamic = 'force-dynamic'

// Public, read-only: exposes only the aggregate rating/count/mapsUrl (never
// the API key) so client components can render the rating badge without a
// server-rendered page.
export async function GET() {
  const data = await getGoogleReviews()
  if (!data) return NextResponse.json(null)
  return NextResponse.json({ rating: data.rating, totalReviews: data.totalReviews, mapsUrl: data.mapsUrl })
}
