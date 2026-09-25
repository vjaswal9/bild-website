import { revalidatePath } from 'next/cache'

// The public list pages are now prerendered and rebuilt on a five-minute
// timer, which is what took the homepage from ~1.5s to first byte down to
// near-instant. The trade-off would be a five-minute wait before an admin
// change shows up publicly, so admin actions that change public content call
// this and the affected pages rebuild immediately instead.
//
// Never throws: a failed revalidation must not fail the admin action that
// triggered it. The worst case without it is the old five-minute wait.
export function revalidatePublic(paths: RevalidateTarget[]) {
  for (const target of paths) {
    const path = typeof target === 'string' ? target : target.path
    try {
      if (typeof target === 'string') revalidatePath(path)
      else revalidatePath(path, target.type)
    } catch (e) {
      console.error('Could not revalidate', path, e)
    }
  }
}

// A dynamic route needs its pattern plus a type, which invalidates every page
// matching it in one call.
export type RevalidateTarget = string | { path: string; type: 'page' | 'layout' }

// An event changed: it appears on the events list and on the homepage.
export const EVENT_PATHS = ['/', '/events']

// A business listing changed: the directory grid and the profile pages.
//
// Profile pages are prerendered on a 30-minute timer, so an admin edit would
// otherwise take up to half an hour to show. Passing the route pattern rather
// than one slug invalidates every profile in a single call - which matters
// because most of the callers here only have the business id to hand, not its
// slug, and threading the slug through all of them to save invalidating 34
// cheap pages would be the wrong trade.
export const directoryPaths = (slug?: string | null): RevalidateTarget[] =>
  slug
    ? ['/directory', `/directory/${slug}`]
    : ['/directory', { path: '/directory/[slug]', type: 'page' }]

// A testimonial was approved or removed: it shows on both.
export const TESTIMONIAL_PATHS = ['/', '/testimonials']
