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
  '/community-rules',
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

// Is this public path live right now? (Admin and API are handled separately.)
export function isLivePath(pathname: string): boolean {
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
