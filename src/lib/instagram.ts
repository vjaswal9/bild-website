// Instagram handles get entered inconsistently: a bare handle ("quickproauto"),
// an @handle, a full profile URL, or a share link with tracking parameters
// ("https://www.instagram.com/quickproauto?igsh=MWx..."). Everything that reads
// or stores the handle goes through here, so the stored value is always a clean
// handle and links never come out as instagram.com/https://instagram.com/...

// Instagram's own rules: 1-30 characters, letters, numbers, full stops and
// underscores only.
const HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/

/**
 * Reduces anything a person might paste down to a bare handle.
 * Returns null when the input is empty or cannot be a valid handle.
 */
export function normaliseInstagramHandle(raw?: string | null): string | null {
  let value = (raw || '').trim()
  if (!value) return null

  // A URL (with or without scheme): take the first path segment.
  const fromUrl = value.match(/instagram\.com\/([^/?#\s]+)/i)
  if (fromUrl) value = fromUrl[1]

  value = value
    .replace(/^@+/, '')        // leading @, however many
    .split(/[?#]/)[0]          // drop ?igsh=... tracking or #fragment
    .replace(/\/+$/, '')       // trailing slashes
    .trim()

  if (!value) return null
  return HANDLE_PATTERN.test(value) ? value : null
}

/** True when the input is usable, or empty. False only for genuine rubbish. */
export function isValidInstagramInput(raw?: string | null): boolean {
  if (!(raw || '').trim()) return true
  return normaliseInstagramHandle(raw) !== null
}

export function parseInstagramHandle(raw?: string | null): { handle: string; profileUrl: string } | null {
  const handle = normaliseInstagramHandle(raw)
  if (!handle) return null
  return { handle, profileUrl: `https://instagram.com/${handle}` }
}

// Instagram can only embed an individual post, never a profile feed.
export function isInstagramPostUrl(url?: string | null): boolean {
  return !!url && /instagram\.com\/(p|reel|tv)\//i.test(url)
}
