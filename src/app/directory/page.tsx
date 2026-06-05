import PageHero from '@/components/ui/PageHero'
import DirectoryClient, { DisplayBusiness } from './DirectoryClient'
import { supabaseAdmin } from '@/lib/supabase-admin'
import staticBusinesses from '@/data/businesses.json'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function DirectoryPage() {
  // Fetch approved submissions from Supabase
  const { data: supabaseApproved } = await supabaseAdmin
    .from('business_submissions')
    .select('*')
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })

  // Map static businesses to DisplayBusiness shape
  const staticMapped: DisplayBusiness[] = staticBusinesses.businesses.map(b => ({
    id: b.id,
    name: b.name,
    ownerName: b.ownerName,
    category: b.category,
    description: b.description,
    contactEmail: b.contactEmail,
    contactPhone: b.contactPhone,
    website: b.website || undefined,
    instagram: b.instagram || undefined,
    location: b.location,
    isVerified: b.isVerified,
    logoUrl: b.logoUrl || undefined,
    memberSince: b.memberSince || undefined,
    tagline: b.tagline || undefined,
    establishedYear: b.establishedYear || undefined,
    licenceVerified: b.licenceVerified || false,
    featured: b.featured || false,
  }))

  // Map Supabase approved submissions to DisplayBusiness shape
  const supabaseMapped: DisplayBusiness[] = (supabaseApproved || []).map(b => ({
    id: b.id,
    name: b.business_name,
    ownerName: b.owner_name,
    category: b.category,
    description: b.description,
    contactEmail: b.email,
    contactPhone: b.phone,
    website: b.website || undefined,
    instagram: b.instagram || undefined,
    location: b.location,
    isVerified: true,
    bildOffer: b.bild_offer || undefined,
    logoUrl: b.logo_url || undefined,
    memberSince: b.created_at ? b.created_at.slice(0, 7) : undefined,
    tagline: b.tagline || undefined,
    establishedYear: b.established_year || undefined,
    // An approved submission with a licence on file is licence-verified
    licenceVerified: !!b.license_url,
    featured: b.featured || false,
  }))

  const allBusinesses = [...staticMapped, ...supabaseMapped]

  return (
    <>
      <PageHero title="Business Directory" subtitle="Find and support British Indian businesses across the UAE" />
      <DirectoryClient businesses={allBusinesses} />
    </>
  )
}
