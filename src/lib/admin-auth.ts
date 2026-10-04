// Admin session token: a signed, expiring cookie value that cannot be forged
// without the secret. Replaces the old guessable literal "authenticated".
//
// Works in both the Edge runtime (middleware) and Node (API routes) because it
// only uses Web Crypto (globalThis.crypto.subtle) - no Node-only imports.

export const ADMIN_COOKIE = 'bild_admin'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8 // 8 hours, in seconds

// Second, separate unlock for the Money section, on top of the standing
// admin session. Short-lived on purpose: financial figures are the most
// sensitive screen in the admin area, and an admin tab left open on a
// shared laptop should not still be showing them an hour later.
export const MONEY_COOKIE = 'bild_money'
export const MONEY_SESSION_MAX_AGE = 60 * 30 // 30 minutes, in seconds

// Prefer a dedicated secret; fall back to the admin password so this works
// without any new env var (setting ADMIN_SESSION_SECRET is stronger).
function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''
}

// True once ADMIN_SESSION_SECRET is set, so the key that signs sessions is no
// longer the same string as the bootstrap admin password.
export function sessionSecretIsSeparate(): boolean {
  return !!process.env.ADMIN_SESSION_SECRET
}

// The key links were signed with before ADMIN_SESSION_SECRET existed. Only the
// non-expiring Google review links still honour it: those are already in
// businesses' inboxes and cannot be re-sent, whereas an admin session just
// asks you to sign in again.
function legacyLinkSecret(): string {
  const legacy = process.env.ADMIN_PASSWORD || ''
  return legacy && legacy !== process.env.ADMIN_SESSION_SECRET ? legacy : ''
}

async function hmacHex(message: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Constant-time comparison of two hex strings.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Create a fresh signed token: "<expiryMs>.<hmac>".
// The scope is signed in, so a session cookie can never be pasted into the
// Money cookie to unlock the financial screens, or the other way round.
async function signScopedToken(scope: string, maxAgeSeconds: number): Promise<string> {
  const exp = Date.now() + maxAgeSeconds * 1000
  const sig = await hmacHex(`${scope}:${exp}`, secret())
  return `${exp}.${sig}`
}

async function verifyScopedToken(scope: string, token?: string | null): Promise<boolean> {
  const s = secret()
  if (!token || !s) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const expStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = await hmacHex(`${scope}:${expStr}`, s)
  return timingSafeEqual(sig, expected)
}

// Legacy session: "<exp>.<sig>", no identity. Still issued while the site runs
// on the single shared login, and honoured only until personal accounts exist.
export async function signAdminToken(): Promise<string> {
  return signScopedToken('admin', ADMIN_SESSION_MAX_AGE)
}

// Personal session: "u.<adminId>.<issuedAt>.<exp>.<sig>". The id says who is
// signed in; the issue time lets a removal or password change end the session
// (see sessionStillValid). Everything is covered by the signature.
export async function signAdminSession(adminId: string): Promise<string> {
  const iat = Date.now()
  const exp = iat + ADMIN_SESSION_MAX_AGE * 1000
  const sig = await hmacHex(`admin-user:${adminId}:${iat}:${exp}`, secret())
  return `u.${adminId}.${iat}.${exp}.${sig}`
}

type ParsedSession = { kind: 'legacy' } | { kind: 'user'; adminId: string; iat: number }

// Signature and expiry only. Whether the person is still allowed in is a
// separate question that needs the database (verifyAdminToken asks it).
async function parseAdminSession(token?: string | null): Promise<ParsedSession | null> {
  const s = secret()
  if (!token || !s) return null

  if (token.startsWith('u.')) {
    const parts = token.split('.')
    if (parts.length !== 5) return null
    const [, adminId, iatStr, expStr, sig] = parts
    const iat = Number(iatStr), exp = Number(expStr)
    if (!/^[0-9a-f-]{36}$/i.test(adminId) || !Number.isFinite(iat) || !Number.isFinite(exp) || exp < Date.now()) return null
    const expected = await hmacHex(`admin-user:${adminId}:${iat}:${exp}`, s)
    return timingSafeEqual(sig, expected) ? { kind: 'user', adminId, iat } : null
  }

  // Legacy shapes. Also accepts the pre-scope format, so an admin already
  // signed in when scoping shipped was not logged out mid-session.
  if (await verifyScopedToken('admin', token)) return { kind: 'legacy' }
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const expStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now()) return null
  const expected = await hmacHex(expStr, s)
  return timingSafeEqual(sig, expected) ? { kind: 'legacy' } : null
}

// ---------------------------------------------------------------------------
// Database checks used on every admin request. Plain fetch against the REST
// API rather than the Supabase client, so this stays small enough for the Edge
// runtime that the admin middleware runs in. Answers are cached for 20 seconds
// per server, so removing an admin takes effect almost at once without a
// database round trip on every click.
// ---------------------------------------------------------------------------
const CHECK_CACHE_MS = 20_000
const checkCache = new Map<string, { at: number; value: boolean | null }>()

async function restRows(path: string): Promise<{ rows: Record<string, unknown>[] } | { missing: true } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' })
    if (res.status === 404) return { missing: true }   // the table has not been created yet
    if (!res.ok) {
      // PostgREST also reports a missing table as a 4xx with this code.
      const body = await res.text().catch(() => '')
      return /PGRST205|42P01/.test(body) ? { missing: true } : null
    }
    return { rows: await res.json() }
  } catch {
    return null
  }
}

async function cached(key: string, run: () => Promise<boolean | null>): Promise<boolean | null> {
  const hit = checkCache.get(key)
  if (hit && Date.now() - hit.at < CHECK_CACHE_MS) return hit.value
  const value = await run()
  if (checkCache.size > 200) checkCache.clear()
  // A failed check (null) is not cached, so the next request tries again.
  if (value !== null) checkCache.set(key, { at: Date.now(), value })
  return value
}

// true once at least one personal admin account is active; false while the
// site is still on the single shared login (or the table does not exist yet);
// null when it could not be determined.
export async function personalAccountsActive(): Promise<boolean | null> {
  return cached('personal-active', async () => {
    const r = await restRows('admin_users?select=id&active=eq.true&limit=1')
    if (!r) return null
    if ('missing' in r) return false
    return r.rows.length > 0
  })
}

async function sessionStillValid(adminId: string, iat: number): Promise<boolean | null> {
  return cached(`user:${adminId}:${iat}`, async () => {
    const r = await restRows(`admin_users?id=eq.${adminId}&select=active,sessions_valid_from&limit=1`)
    if (!r) return null
    if ('missing' in r) return false
    const row = r.rows[0] as { active?: boolean; sessions_valid_from?: string } | undefined
    if (!row || !row.active) return false
    const from = row.sessions_valid_from ? Date.parse(row.sessions_valid_from) : 0
    // A second of slack for the clocks of the database and the server.
    return iat >= from - 1000
  })
}

// Verify a cookie value: genuine, unexpired, and the person behind it is still
// allowed in. Fails closed if the database cannot be asked.
export async function verifyAdminToken(token?: string | null): Promise<boolean> {
  const parsed = await parseAdminSession(token)
  if (!parsed) return false
  if (parsed.kind === 'legacy') {
    // A shared-login session stops working the moment personal accounts exist.
    return (await personalAccountsActive()) === false
  }
  return (await sessionStillValid(parsed.adminId, parsed.iat)) === true
}

// Who is signed in: an account id, 'legacy' for the shared login, or null.
// Does not re-check the database; call verifyAdminToken first.
export async function sessionIdentity(token?: string | null): Promise<string | 'legacy' | null> {
  const parsed = await parseAdminSession(token)
  if (!parsed) return null
  return parsed.kind === 'legacy' ? 'legacy' : parsed.adminId
}

// Called after a change that must end someone's sessions at once.
export function forgetSessionChecks() {
  checkCache.clear()
}

export async function signMoneyToken(): Promise<string> {
  return signScopedToken('money', MONEY_SESSION_MAX_AGE)
}

export async function verifyMoneyToken(token?: string | null): Promise<boolean> {
  return verifyScopedToken('money', token)
}

// ---------------------------------------------------------------------------
// Password hashing (PBKDF2-SHA256) and random tokens - pure Web Crypto.
// ---------------------------------------------------------------------------
// OWASP's current guidance for PBKDF2-SHA256 is 600,000 rounds. Hashes made
// earlier keep their own stored count and still verify; they are upgraded the
// next time their owner signs in.
export const PBKDF2_ITER = 600_000

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
}
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}
export function randomToken(bytes = 24): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

async function pbkdf2(password: string, saltHex: string, iterations: number): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex) as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return bytesToHex(new Uint8Array(bits))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomToken(16)
  const hash = await pbkdf2(password, salt, PBKDF2_ITER)
  return `pbkdf2$${PBKDF2_ITER}$${salt}$${hash}`
}

export async function verifyPassword(password: string, stored?: string | null): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations)) return false
  const candidate = await pbkdf2(password, parts[2], iterations)
  return timingSafeEqual(candidate, parts[3])
}

// ---------------------------------------------------------------------------
// Personal link for a directory business to add its own Google reviews.
// ---------------------------------------------------------------------------
// Signed rather than stored, so no database change is needed, and it cannot be
// forged or pointed at another listing. It does not expire, so the same link
// still works if a business comes back later to update its Google link.
// The scope is signed in, so it can never stand in for an admin session.
export async function signGoogleReviewsLinkToken(businessId: string): Promise<string> {
  const sig = await hmacHex(`google-reviews:${businessId}`, secret())
  return `${businessId}.${sig}`
}

// True when a stored hash was made with fewer rounds than we use now.
export function needsRehash(stored?: string | null): boolean {
  const parts = (stored || '').split('$')
  return parts.length === 4 && parts[0] === 'pbkdf2' && Number(parts[1]) < PBKDF2_ITER
}

// Returns the business id the link belongs to, or null if it is not genuine.
export async function verifyGoogleReviewsLinkToken(token?: string | null): Promise<string | null> {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const businessId = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return null
  for (const key of [secret(), legacyLinkSecret()]) {
    if (!key) continue
    const expected = await hmacHex(`google-reviews:${businessId}`, key)
    if (timingSafeEqual(sig, expected)) return businessId
  }
  return null
}
