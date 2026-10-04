import { supabaseAdmin } from '@/lib/supabase-admin'
import { reportError } from '@/lib/report-error'

// Best-effort in-memory rate limiter, keyed per-IP per-bucket. Serverless
// instances aren't shared, so this isn't bulletproof, but it stops a simple
// script from spamming a public endpoint thousands of times per instance.
const buckets = new Map<string, { count: number; first: number }>()

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
}

export function isRateLimited(key: string, opts: { windowMs: number; max: number }): boolean {
  const now = Date.now()
  const rec = buckets.get(key)
  if (!rec || now - rec.first > opts.windowMs) {
    buckets.set(key, { count: 1, first: now })
    return false
  }
  rec.count += 1
  return rec.count > opts.max
}

let warnedSharedDown = false

// The same check, but counted in the database so every serverless instance
// shares one tally and a script cannot multiply its allowance by landing on
// different instances. Use this for anything that sends email, costs money or
// guards a password. Needs supabase/rate-limits.sql to have been run.
//
// If the database call fails it falls back to the in-memory counter rather
// than blocking real visitors, and says so once in the logs.
export async function isRateLimitedShared(key: string, opts: { windowMs: number; max: number }): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
      p_key: key,
      p_window_seconds: Math.max(1, Math.round(opts.windowMs / 1000)),
    })
    if (error) throw new Error(error.message)
    return Number(data) > opts.max
  } catch (e) {
    if (!warnedSharedDown) {
      warnedSharedDown = true
      reportError('Shared rate limiter unavailable, using per-instance counting:', e instanceof Error ? e.message : e)
    }
    return isRateLimited(key, opts)
  }
}
