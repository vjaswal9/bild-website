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
  // Run on all routes except API, Next internals, and static files.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
