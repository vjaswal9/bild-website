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
