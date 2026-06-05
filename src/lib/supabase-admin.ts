import { createClient } from '@supabase/supabase-js'
import type { BusinessSubmission } from './supabase'

// Admin client SERVER SIDE ONLY. Never import this in client components.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export type { BusinessSubmission }
