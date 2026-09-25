// Server only: uses the service-role client.
import { supabaseAdmin } from './supabase-admin'
import { signGoogleReviewsLinkToken } from './admin-auth'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'

// The personal page where one business adds or updates its Google review link.
export async function googleReviewsLinkFor(businessId: string): Promise<string> {
  return `${SITE_URL}/directory/google-reviews/${await signGoogleReviewsLinkToken(businessId)}`
}

export type InviteRecipient = {
  id: string
  businessName: string
  ownerName: string | null
  email: string
  slug: string
  // A Google link was saved when they applied but it is a kind Google does not
  // let us read reviews from, so their email explains that.
  brokenLink: boolean
}

// Who the Google reviews invitation goes to: every live listing with an email
// that is not already showing Google reviews.
export async function googleReviewsInviteRecipients(): Promise<{
  recipients: InviteRecipient[]
  alreadyActive: { id: string; businessName: string }[]
}> {
  const { data } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, owner_name, email, slug, status, delisted_at, google_maps_url, google_place_id')
    .eq('status', 'approved')
    .is('delisted_at', null)
    .order('business_name', { ascending: true })

  const live = (data || []).filter(b => typeof b.email === 'string' && b.email.includes('@'))
  return {
    recipients: live
      .filter(b => !b.google_place_id)
      .map(b => ({
        id: b.id,
        businessName: b.business_name,
        ownerName: b.owner_name,
        email: b.email,
        slug: b.slug,
        brokenLink: !!b.google_maps_url,
      })),
    alreadyActive: live.filter(b => b.google_place_id).map(b => ({ id: b.id, businessName: b.business_name })),
  }
}
