// Small, dependency-free coercions for request bodies.
//
// The 61 API routes each re-derived their own version of "turn this unknown
// thing from the internet into a string I can store". Most did it well, some
// did it partially, and a few passed the raw value straight to the database.
// The worst case was free text with no length cap being written to a column
// and then rendered back out.
//
// This is deliberately not a schema library. The house style already reads
// fields one at a time (see the waitlist route, which does this properly by
// hand), so these are the four coercions that style keeps needing, in one
// place, with the caps applied by default rather than remembered.

/** A trimmed string, capped in length. Anything that is not a string becomes ''. */
export function str(value: unknown, max = 200): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

/** As `str`, but returns undefined for an empty result, for optional columns. */
export function optionalStr(value: unknown, max = 200): string | undefined {
  const s = str(value, max)
  return s === '' ? undefined : s
}

/**
 * One of a known set, or the fallback.
 *
 * Use this rather than storing whatever arrived: it is the difference between
 * a column that can only hold the options the form offers and one that can
 * hold anything a script cares to post.
 */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

/** A whole number clamped into range. Anything unparseable becomes `min`. */
export function int(value: unknown, min: number, max: number): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return min
  return Math.min(Math.max(n, min), max)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A UUID, or null. Guards `.eq('id', …)` against being handed rubbish. */
export function uuid(value: unknown): string | null {
  return typeof value === 'string' && UUID.test(value) ? value : null
}

/**
 * An http(s) URL, or undefined.
 *
 * Only these two schemes: a stored `javascript:` or `data:` URL becomes an
 * attack the moment it is rendered as a link on a profile page.
 */
export function httpUrl(value: unknown, max = 500): string | undefined {
  const s = str(value, max)
  if (!s) return undefined
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

/**
 * A flat object of short strings, or {}.
 *
 * For form answers that are stored whole in a jsonb column. Keeps only
 * string values, caps how many keys and how long each key and value may be, so
 * a script cannot park megabytes of arbitrary data in the database through a
 * public form.
 */
export function stringMap(value: unknown, maxKeys = 40, maxKey = 60, maxValue = 500): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  let n = 0
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (n >= maxKeys) break
    if (typeof v !== 'string' || k.length === 0 || k.length > maxKey) continue
    out[k] = v.slice(0, maxValue)
    n++
  }
  return out
}
