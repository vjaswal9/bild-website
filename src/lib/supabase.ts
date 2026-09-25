import { createClient } from '@supabase/supabase-js'

// Public client (safe to use in the browser)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type BusinessSubmission = {
  id: string
  created_at: string
  status: 'pending' | 'approved' | 'rejected'
  business_name: string
  category: string
  description: string
  location: string
  owner_name: string
  phone: string
  email: string
  website?: string
  instagram?: string
  linkedin?: string
  logo_url?: string
  // Wide hero image at the top of the profile page. Optional - a branded band
  // is generated from the logo when this is empty.
  banner_url?: string
  // Admin override for the banner backdrop: 'light', 'dark', or empty/absent
  // to decide automatically from whether the image is transparent.
  banner_bg?: string
  // A single Instagram POST permalink to embed. Distinct from `instagram`
  // above, which is the handle: Instagram cannot embed a profile feed.
  instagram_post_url?: string
  years_in_business?: string
  tagline?: string
  established_year?: string
  bild_member_since?: string
  bild_offer?: string
  extra_info?: string
  admin_notes?: string
  reviewed_at?: string
  featured?: boolean
  business_country: 'UAE' | 'UK'
  slug?: string
  document_url?: string
  document_expiry_date?: string
  delisted_at?: string
  delisted_reason?: string
  // Set by the weekly link check. fail_count reaching 2 means the website has
  // failed twice in a row and is almost certainly genuinely down.
  website_checked_at?: string
  website_status?: number
  website_fail_count?: number
  website_error?: string
  document_reminder_sent_at?: string
  renewal_token?: string
  renewal_token_expires_at?: string
  pending_document_url?: string
  pending_document_expiry_date?: string
  pending_renewal_submitted_at?: string
  is_bild_member: boolean
  listing_paid_until?: string
  listing_payment_token?: string
  listing_payment_token_expires_at?: string
  listing_renewal_reminder_sent_at?: string
  listing_final_reminder_sent_at?: string
  listing_expired_notice_sent_at?: string
  // The single chase sent to a business that was approved but never paid.
  listing_activation_reminder_sent_at?: string
  // Set when a second payment link expired unpaid. Archives the listing as
  // "applied but never paid": still approved, never live, no longer chased.
  listing_abandoned_at?: string
  listing_fee_exempt?: boolean
  featured_paid_until?: string
  featured_payment_token?: string
  featured_payment_token_expires_at?: string
  featured_renewal_reminder_sent_at?: string
  featured_final_reminder_sent_at?: string
  featured_expired_notice_sent_at?: string
  featured_manage_token?: string
  featured_bio?: string
  featured_gallery_urls?: string[]
  featured_video_url?: string
  featured_offers?: string[]
  // Featured only: a PDF visitors can download from the profile page.
  featured_brochure_url?: string | null
  featured_brochure_name?: string | null
  profile_view_count?: number
  google_maps_url?: string
  google_place_id?: string
  membership_manually_verified?: boolean
}
