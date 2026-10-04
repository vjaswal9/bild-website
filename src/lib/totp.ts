// Time-based one-time passwords (RFC 6238) for the admin two-factor login.
// Works with Google Authenticator, Microsoft Authenticator, Authy, 1Password
// and anything else that scans a standard otpauth QR code. Web Crypto only, so
// there is no extra dependency to keep patched for the part that guards the
// front door.

const STEP_SECONDS = 30
const DIGITS = 6
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = ''
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase()
  const out: number[] = []
  let bits = 0, value = 0
  for (const ch of clean) {
    const i = B32.indexOf(ch)
    if (i === -1) throw new Error('Invalid base32')
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return new Uint8Array(out)
}

// A fresh 160-bit secret, the size authenticator apps expect.
export function generateTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)))
}

async function hotp(secret: Uint8Array, counter: number, digits = DIGITS): Promise<string> {
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter >>> 0)
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf))
  const offset = mac[mac.length - 1] & 0x0f
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

export async function totpAt(secretB32: string, timeMs: number, digits = DIGITS): Promise<string> {
  return hotp(base32Decode(secretB32), Math.floor(timeMs / 1000 / STEP_SECONDS), digits)
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Checks a typed code against the current 30-second step and one either side
// (phone clocks drift). Returns the step that matched, or null. Steps at or
// before `lastStep` are refused, so a code that has been used - or one an
// onlooker saw over a shoulder - cannot be used a second time.
export async function verifyTotp(
  secretB32: string,
  code: string,
  lastStep: number | null,
  nowMs = Date.now(),
): Promise<number | null> {
  const typed = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(typed)) return null
  const secret = base32Decode(secretB32)
  const current = Math.floor(nowMs / 1000 / STEP_SECONDS)
  let matched: number | null = null
  // Check all three even after a hit so timing does not reveal which matched.
  for (const step of [current - 1, current, current + 1]) {
    const expected = await hotp(secret, step)
    if (sameString(expected, typed) && (lastStep == null || step > lastStep)) matched = step
  }
  return matched
}

// The address an authenticator app reads from the QR code.
export function otpauthUri(secretB32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`
}

// One-time recovery codes for a lost phone. 10 characters from an alphabet
// with no look-alikes, shown as xxxxx-xxxxx.
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(10))
    const raw = Array.from(bytes, b => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('')
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
}

export function normaliseRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(normaliseRecoveryCode(code))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('')
}
