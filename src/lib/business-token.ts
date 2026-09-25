import { supabaseAdmin } from './supabase-admin'

// Resolves the standing "manage my listing" link to the business holding it.
//
// The column is still called featured_manage_token because that is what it was
// first used for, but it is now the general manage token: every approved
// business has one, and the manage page uses it for the testimonials form
// whether or not the business has ever paid for Featured. Renaming the column
// would invalidate nothing, but it is referenced in enough places that the
// comment is cheaper than the churn.
export type ManagedBusiness = {
  id: string
  business_name: string
  slug: string | null
  email: string | null
  featured: boolean | null
  featured_paid_until: string | null
}

export async function businessByManageToken(token: unknown): Promise<ManagedBusiness | null> {
  if (typeof token !== 'string' || token.length < 16) return null

  const { data } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, slug, email, status, delisted_at, featured, featured_paid_until')
    .eq('featured_manage_token', token)
    .maybeSingle()

  if (!data) return null
  // A delisted or unapproved listing has no business adding content to a
  // profile page that is not live.
  if (data.status !== 'approved' || data.delisted_at) return null
  return data as ManagedBusiness
}

// Whether the Featured extras (bio, gallery, video, offers, brochure) are
// available, as opposed to the testimonials form, which every approved
// business gets.
export function isFeaturedActive(biz: Pick<ManagedBusiness, 'featured' | 'featured_paid_until'>): boolean {
  return !!biz.featured && (biz.featured_paid_until == null || new Date(biz.featured_paid_until) >= new Date())
}
