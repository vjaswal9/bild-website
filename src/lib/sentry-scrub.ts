// Removes secrets from anything about to be sent to Sentry.
//
// BILD uses private links as passwords: /directory/manage/<token>,
// /events/upgrade/<token>, /j/<token> and so on. A server error on one of
// those pages would otherwise send the full address to Sentry, and so would
// the database calls recorded alongside it, whose addresses carry the token
// or an email in the query string. Sentry is a third party, so the secrets
// are stripped before anything leaves.

const REPLACEMENTS: [RegExp, string][] = [
  // Private link pages: keep the page type, drop the secret.
  [/\/(directory\/(?:manage|renew|pay|feature|google-reviews)|events\/upgrade|j)\/[^/?#"'\s]+/g, '/$1/[token]'],
  // Database filters recorded as web requests: ...?featured_manage_token=eq.abc
  [/([a-z_]*(?:token|email)=(?:eq|ilike|like)\.)[^&"'\s)]+/gi, '$1[redacted]'],
  // Stripe session ids and receipt links on return pages.
  [/(session_id=)[^&"'\s]+/g, '$1[redacted]'],
  [/(free=)[0-9a-f-]{36}/gi, '$1[redacted]'],
  // Anything shaped like an email address in free text.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
]

export function scrubString(value: string): string {
  let out = value
  for (const [re, to] of REPLACEMENTS) out = out.replace(re, to)
  return out
}

const DROP_HEADERS = new Set(['cookie', 'authorization', 'stripe-signature', 'x-cron-secret', 'x-forwarded-for', 'x-real-ip'])

// Walks the event and cleans every string in it. Depth-limited so a weird
// payload cannot make this loop.
function walk(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return scrubString(value)
  if (depth > 8 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(v => walk(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = walk(v, depth + 1)
  }
  return out
}

export function scrubEvent<T>(event: T): T {
  const cleaned = walk(event, 0) as T & { request?: { headers?: Record<string, string>; cookies?: unknown; data?: unknown; query_string?: unknown } }
  const req = cleaned?.request
  if (req) {
    if (req.headers) {
      for (const k of Object.keys(req.headers)) if (DROP_HEADERS.has(k.toLowerCase())) delete req.headers[k]
    }
    delete req.cookies
    delete req.data
    if (req.query_string) req.query_string = '[redacted]'
  }
  return cleaned
}
