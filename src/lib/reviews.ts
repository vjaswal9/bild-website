// Server-only. Combines Google reviews with approved member-submitted
// testimonials into one unified list for display (homepage carousel and the
// full /testimonials page).
import { getGoogleReviews, GoogleReviewsData } from './google-reviews'
import { supabaseRead } from './supabase-admin'
import { PUBLIC_TESTIMONIAL_COLUMNS, Testimonial } from './testimonials'
import type { CarouselReview } from '@/components/home/ReviewsCarousel'

export async function getCombinedReviews(): Promise<{
  google: GoogleReviewsData | null
  testimonials: Testimonial[]
  combined: CarouselReview[]
}> {
  const google = await getGoogleReviews()

  const { data: testimonialRows } = await supabaseRead
    .from('testimonials')
    // Never '*': the reviewer's email and phone are admin-only.
    .select(PUBLIC_TESTIMONIAL_COLUMNS)
    .eq('status', 'approved')
    // Reviews left against a specific directory business live in this same
    // table but belong on that business's profile page, not in BILD's own
    // homepage carousel or /testimonials page.
    .is('business_id', null)
    .order('created_at', { ascending: false })
  const testimonials = (testimonialRows || []) as Testimonial[]

  const googleCarouselReviews: CarouselReview[] = (google?.reviews || []).map(r => ({
    source: 'google' as const,
    author: r.author,
    subtitle: r.relativeTime,
    rating: r.rating,
    text: r.text,
    profilePhotoUrl: r.profilePhotoUrl,
  }))
  const bildCarouselReviews: CarouselReview[] = testimonials.map(t => {
    const monthYear = new Date(t.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    return {
      source: 'bild' as const,
      author: t.name,
      subtitle: t.headline ? `${t.headline} · ${monthYear}` : monthYear,
      rating: t.rating,
      text: t.quote,
    }
  })

  // Interleave so member testimonials aren't buried at the end of a long Google list.
  const combined: CarouselReview[] = []
  const maxLen = Math.max(googleCarouselReviews.length, bildCarouselReviews.length)
  for (let i = 0; i < maxLen; i++) {
    if (googleCarouselReviews[i]) combined.push(googleCarouselReviews[i])
    if (bildCarouselReviews[i]) combined.push(bildCarouselReviews[i])
  }

  return { google, testimonials, combined }
}
