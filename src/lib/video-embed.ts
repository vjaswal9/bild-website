// Turns whatever link a business pasted into a safe embed address, or null.
//
// The profile page used to put the pasted text straight into an iframe's src.
// An iframe will happily load a javascript: address, which runs script on our
// own page, so only YouTube and Vimeo links are accepted and the embed address
// is rebuilt from the video's id rather than echoing the input back.
export function toEmbedUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')

  let id: string | null = null
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)
      id = m ? m[1] : null
    }
  } else if (host === 'youtu.be') {
    id = u.pathname.slice(1).split('/')[0] || null
  }
  if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `https://www.youtube.com/embed/${id}`

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/\/(?:video\/)?(\d{5,12})(?:\/|$)/)
    if (m) return `https://player.vimeo.com/video/${m[1]}`
  }
  return null
}
