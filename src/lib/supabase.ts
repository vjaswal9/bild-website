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
  logo_url?: string
  years_in_business?: string
  tagline?: string
  established_year?: string
  bild_offer?: string
  extra_info?: string
  admin_notes?: string
  reviewed_at?: string
  license_url?: string
  featured?: boolean
}
