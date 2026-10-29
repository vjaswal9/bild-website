// Soft-launch control.
// While LAUNCH_MODE is true, only the paths in LIVE_PATHS are publicly
// reachable; every other page shows the "coming soon" placeholder, and nav /
// footer links to hidden pages are hidden. To reveal a page later, add its
// path here (or set LAUNCH_MODE to false to open the whole site).

export const LAUNCH_MODE = true

// Public paths that are live at launch (prefix match, except '/').
export const LIVE_PATHS = [
  '/',                 // landing page
  '/join',             // join flow + /join/success
  '/j',                // single-use WhatsApp invite redirect (/j/<token>)
  '/about',
  '/directory',        // business directory + /directory/submit
  '/events',           // events listing + /events/[slug]
  '/photo-vault',      // downloadable event photo/video gallery
  '/faces-of-bild',
  '/testimonials',     // "share your experience" submission form
  '/terms',
  '/code-of-conduct',
  '/contact',           // contact page
  '/privacy',           // privacy policy
  '/refund-policy',     // refund policy
  '/coming-soon',      // the placeholder itself
]

// Real pages that exist but are deliberately not launched yet. These are the
// ONLY paths that should show the "coming soon" placeholder.
//
// Everything else that is not live is simply a URL that does not exist: a
// typo, a stale link, or a crawler guessing. Those must return a genuine 404.
// Rewriting them to the placeholder returned HTTP 200, which told search
// engines that an unlimited number of junk URLs were real pages all carrying
// the same content.
export const COMING_SOON_PATHS = ['/knowledge-base']

export function isComingSoonPath(pathname: string): boolean {
  return COMING_SOON_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// ---- Business Directory publish switch ----
//
// Set to false to take the public Business Directory offline temporarily: the
// directory page, every business profile, and the "list your business" and
// "get featured" pages show a "temporarily unavailable" page, and every link
// and promotion that points at them disappears from the menu, footer, home
// page, About and Contact pages and the sitemap. Nothing is deleted. Set it
// back to true and deploy to publish everything again.
//
// The one-time links already sent to businesses (pay, renew or upload
// documents, manage, Google reviews) are NOT hidden: a business partway
// through paying, or uploading the documents it was asked for, must still be
// able to finish. This is why the list below exists instead of hiding every
// path under /directory.
export const DIRECTORY_PUBLISHED = false

const DIRECTORY_PRIVATE_PREFIXES = [
  '/directory/pay',
  '/directory/renew',
  '/directory/manage',
  '/directory/feature',
  '/directory/google-reviews',
]

export function isHiddenDirectoryPath(pathname: string): boolean {
  if (DIRECTORY_PUBLISHED) return false
  if (pathname !== '/directory' && !pathname.startsWith('/directory/')) return false
  return !DIRECTORY_PRIVATE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// ---- Photo Vault publish switch ----
//
// Set to false to take the public Photo Vault offline temporarily: /photo-vault
// shows a "temporarily unavailable" page (503 with Retry-After, noindex), and
// the menu, footer, sitemap and the member email link to it disappear. Nothing
// is deleted: photos and videos stay on their events and in the admin. Set it
// back to true and deploy to publish it again. See also PAST_EVENTS_PUBLISHED.
export const PHOTO_VAULT_PUBLISHED = true

export function isHiddenPhotoVaultPath(pathname: string): boolean {
  if (PHOTO_VAULT_PUBLISHED) return false
  return pathname === '/photo-vault' || pathname.startsWith('/photo-vault/')
}

// ---- Past events publish switch ----
//
// Set to false to take past events offline temporarily: the "Past Events"
// section of the Events page disappears, every past event's own page returns
// "not found", and past events leave the sitemap. Upcoming events are not
// affected. Nothing is deleted. Set it back to true and deploy to bring them
// back. Checked in src/app/events/page.tsx, src/app/events/[slug]/page.tsx and
// src/app/sitemap.ts.
export const PAST_EVENTS_PUBLISHED = true

// Is this public path live right now? (Admin and API are handled separately.)
export function isLivePath(pathname: string): boolean {
  if (isHiddenDirectoryPath(pathname)) return false
  if (isHiddenPhotoVaultPath(pathname)) return false
  if (!LAUNCH_MODE) return true
  if (pathname === '/') return true
  return LIVE_PATHS.some(p => p !== '/' && (pathname === p || pathname.startsWith(p + '/')))
}

// The per-business star-rating review system that used to be flagged here has
// been removed. It let visitors review a business and was never switched on.
// What replaced it is different in kind: a business sends in testimonials its
// own customers already gave it, with a screenshot of the original message as
// proof, and an admin approves each one before it appears on that business's
// profile. See src/app/api/business/testimonials and supabase/business-testimonials.sql.
