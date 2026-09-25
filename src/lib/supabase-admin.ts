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

// Public read client. Same service-role key, but WITHOUT the no-store fetch
// wrapper above.
//
// That wrapper is what admin screens need and what public pages must not have:
// a `cache: 'no-store'` fetch anywhere in a route opts the whole route into
// per-request rendering, no matter what `revalidate` the page sets. That was
// why the homepage, the events list and the directory were each running a
// database round trip before sending a single byte, measured at roughly 1.5s
// to first byte against 0.15s for the pages with nothing to fetch.
//
// Use this ONLY for data that is already public on the page being rendered,
// and never for anything where a few minutes of staleness would matter, such
// as remaining ticket capacity at the point of purchase.
export const supabaseRead = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

export type { BusinessSubmission }
