export type Testimonial = {
  id: string
  created_at: string
  reviewed_at?: string | null
  name: string
  headline?: string | null
  quote: string
  rating: number
  status: 'pending' | 'approved' | 'rejected'
  // Null = a testimonial about BILD itself. Set = a review of that directory
  // business, shown on its profile page instead of BILD's own testimonials.
  business_id?: string | null
  // ADMIN ONLY - captured so an admin can check a reviewer is genuine before
  // approving. Never selected by public-facing queries, never rendered publicly.
  reviewer_email?: string | null
  reviewer_phone?: string | null
}

// The only columns any public-facing query may select. Deliberately excludes
// reviewer_email / reviewer_phone.
export const PUBLIC_TESTIMONIAL_COLUMNS = 'id, created_at, name, headline, quote, rating, status, business_id'
