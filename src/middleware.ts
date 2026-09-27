import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { isLivePath, isComingSoonPath } from '@/lib/launch'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin area stays behind its own auth (unchanged by the soft launch).
  if (pathname.startsWith('/admin')) {
    const openAdminPaths = ['/admin/login', '/admin/confirm-password']
    if (!openAdminPaths.includes(pathname)) {
      const ok = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)
      if (!ok) return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return NextResponse.next()
  }

  if (isLivePath(pathname)) return NextResponse.next()

  // Soft launch: a real page that is not launched yet shows the "coming soon"
  // placeholder. The rewrite keeps the URL, so the real page is simply not
  // reachable.
  if (isComingSoonPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/coming-soon'
    return NextResponse.rewrite(url)
  }

  // Anything else is a URL that does not exist. Letting it through means Next
  // finds no matching route and returns a real 404 with the not-found page,
  // rather than the placeholder answering 200 to every typo on the internet.
  return NextResponse.next()
}

export const config = {
  // Deliberately NARROW. This used to run on every route except API, Next
  // internals and static files, which meant a middleware invocation on every
  // page view on the site - including fully prerendered pages that otherwise
  // cost nothing to serve. On the Vercel usage chart that was 1h 6m of 3h 26m
  // Fluid Active CPU over thirty days, a third of the total, spent almost
  // entirely on concluding that a live page was live.
  //
  // Only two prefixes actually need middleware now:
  //   /admin          - the auth check, which must run before the page does
  //   /knowledge-base - the sole remaining COMING_SOON_PATHS entry
  //
  // Every other public page is in LIVE_PATHS, so isLivePath returned true and
  // the middleware fell straight through to NextResponse.next(). Unknown URLs
  // did the same and were left to Next's own 404, which is still what happens
  // now that middleware never sees them.
  //
  // BEFORE WIDENING THIS AGAIN: if a page is added to COMING_SOON_PATHS in
  // src/lib/launch.ts, add its prefix here too, or it will be reachable rather
  // than showing the placeholder. Setting LAUNCH_MODE = false needs no change
  // here. Both forms of each prefix are listed so the bare path matches as
  // well as its children.
  matcher: ['/admin', '/admin/:path*', '/knowledge-base', '/knowledge-base/:path*'],
}
