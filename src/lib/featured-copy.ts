// Single source of truth for the "Get Featured" pitch - reused on the
// payment page, the discovery page, and both Featured emails, so the offer
// never drifts out of sync between the website and inbox.
export const FEATURED_BENEFITS = [
  'Gold-highlighted, boosted-visibility placement in the directory',
  'A richer profile page: extended bio, up to 6 extra photos, an embedded video, a downloadable PDF brochure, and multiple member offers instead of one',
  'Larger, more prominent social and contact links',
  'See how many people are viewing your profile',
  '3 months at a time, renew whenever you like',
]

export const FEATURED_MEMBER_FEE_AED = 1000
export const FEATURED_NON_MEMBER_FEE_AED = 2000
export const LISTING_MEMBER_FEE_AED = 300
export const LISTING_NON_MEMBER_FEE_AED = 600
// Every listing approved before this moment is free until it (end of 31 December
// 2026, Dubai time), members and non-members alike. Featured stays paid. To end
// the offer early or extend it, change these two lines and deploy; listings
// already approved keep the date they were given (see
// supabase/directory-free-until-dec-2026.sql).
export const LISTING_GRACE_CUTOFF = '2026-12-31T23:59:59+04:00'
export const LISTING_GRACE_LABEL = '31 December 2026'
