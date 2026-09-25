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

export async function signAdminToken(): Promise<string> {
  return signScopedToken('admin', ADMIN_SESSION_MAX_AGE)
}

// Verify a cookie value: correct signature and not expired.
export async function verifyAdminToken(token?: string | null): Promise<boolean> {
  // Also accepts the pre-scope token format, so an admin already signed in
  // when this shipped is not logged out mid-session.
  if (await verifyScopedToken('admin', token)) return true
  const s = secret()
  if (!token || !s) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const expStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = await hmacHex(expStr, s)
  return timingSafeEqual(sig, expected)
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
const PBKDF2_ITER = 100_000

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

// Returns the business id the link belongs to, or null if it is not genuine.
export async function verifyGoogleReviewsLinkToken(token?: string | null): Promise<string | null> {
  const s = secret()
  if (!token || !s) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const businessId = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return null
  const expected = await hmacHex(`google-reviews:${businessId}`, s)
  return timingSafeEqual(sig, expected) ? businessId : null
}
