import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Public client — used in browser (form submissions, reading approved businesses)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client — used server-side only (approve/reject, read all submissions)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

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
  bild_offer?: string
  extra_info?: string
  admin_notes?: string
  reviewed_at?: string
}
