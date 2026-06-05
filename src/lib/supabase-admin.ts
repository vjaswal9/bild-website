import { createClient } from '@supabase/supabase-js'
import type { BusinessSubmission } from './supabase'

// Admin client. SERVER SIDE ONLY. Never import this in client components.
// A no-store fetch wrapper ensures reads always hit live data (never the
// Next.js data cache), so admin changes appear immediately.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
    auth: { persistSession: false },
  }
)

export type { BusinessSubmission }
