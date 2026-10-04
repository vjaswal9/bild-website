// The address Stripe sends a buyer back to after paying or cancelling.
//
// This used to be built from the request's Origin or Host header, which the
// caller controls. A request from another site could therefore ask for a
// checkout whose return address pointed at that site. The address now comes
// from our own configuration. Only a local development host is taken from the
// request, so testing on localhost still works.
export function siteOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/+$/, '')
  try {
    const u = new URL(req.url)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return u.origin
  } catch { /* fall through */ }
  return 'https://www.bild.ae'
}
