import { withSentryConfig } from '@sentry/nextjs/config'

// The Content-Security-Policy being trialled. It is sent as REPORT-ONLY: a
// browser that sees something it would have blocked posts a note to
// /api/csp-report and carries on loading the page exactly as before, so this
// cannot break the site. Once the reports have been quiet for a week or two it
// can be turned into an enforcing header.
//
// What each part is for:
//   script-src   only our own scripts plus the few third parties the site uses
//                (Google Analytics, Instagram embeds). 'unsafe-inline' stays for
//                now because Next.js writes small inline scripts into every page
//                and giving them nonces would make every page render on demand
//                instead of coming from cache.
//   frame-src    which sites may appear inside a frame on our pages.
//   object-src, base-uri, form-action   close off old tricks outright.
const supabaseHost = 'https://mwzqlxhutpsuivgcuxtw.supabase.co'
const isDev = process.env.NODE_ENV !== 'production'
const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.google-analytics.com https://www.instagram.com https://static.cdninstagram.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHost} https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com`,
  `media-src 'self' blob: ${supabaseHost}`,
  "frame-src https://www.instagram.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://www.googletagmanager.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  'report-uri /api/csp-report',
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not announce the framework in an X-Powered-By header on every response.
  poweredByHeader: false,
  images: {
    // Event flyers, business logos and gallery images are all served from
    // Supabase storage. Without this, next/image refuses that host, which is
    // why they were being rendered as plain <img> tags: full-size originals,
    // no modern formats, no width or height, and preloaded ahead of the hero
    // they compete with.
    remotePatterns: [
      { protocol: 'https', hostname: 'mwzqlxhutpsuivgcuxtw.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  async redirects() {
    return [
      // Legacy/incorrectly-indexed URL — send straight to the real homepage.
      { source: '/home', destination: '/', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        // Baseline security headers on every response. Only HSTS was set
        // before, which left the site framable by another domain: a phishing
        // page could load bild.ae inside itself and wrap the join flow in a
        // form that harvests details.
        source: '/(.*)',
        headers: [
          // Never let a browser guess a file's type from its contents.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Blocks framing. frame-ancestors is the modern rule; X-Frame-Options
          // is kept for older browsers that ignore it.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          // Trial run of a full policy. Report-only: reports problems, blocks nothing.
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Send the full URL to ourselves, only the origin to other sites,
          // and nothing at all when downgrading to http.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The site asks for none of these, so deny them outright.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
        ],
      },
      // The /directory no-store rules that used to sit here have been removed.
      // Those pages are built with `revalidate = 300`, so Next already serves
      // them from the ISR cache and refreshes them every five minutes. Sending
      // no-store on top of that threw away the browser and CDN caching that
      // ISR exists to provide, so every visit re-fetched HTML that was already
      // known to be current. The /admin rule below is a different matter and
      // stays: those pages are per-admin and must never be cached.
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ]
  },
}

// Sentry needs to wrap the config to do three things it cannot do from a
// runtime init alone: upload source maps, wrap the server routes and server
// components so their throws are attributed properly, and serve its own
// ingest endpoint from this domain.
//
// Without the source map upload every client-side stack trace in Sentry
// points at minified chunk names, which makes them close to useless.
//
// The upload needs SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT in the
// Vercel build environment. If they are absent the build still succeeds; it
// simply carries on without uploading, which is why `silent` is set rather
// than letting a missing token fail a deploy.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Left noisy on purpose. A silent build cannot be distinguished from one
  // that skipped the source map upload, and a skipped upload is invisible
  // until the day you need a stack trace and find it minified.
  silent: false,
  // Covers the files Next serves from outside the default client directory.
  widenClientFileUpload: true,
  // Maps are uploaded to Sentry and then dropped from the deployment, so
  // stack traces are readable to BILD without publishing the source to
  // visitors.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // No tunnelRoute any more. It existed so ad blockers could not suppress
  // browser error reports, and there are no browser error reports now: the
  // client SDK was removed because 113 KB on every page was more than
  // browser-side reporting was worth. Server and edge reporting is untouched
  // and does not go through the browser at all.
  webpack: {
    // Middleware runs at the edge on every single HTML request, so its bundle
    // size is paid as latency by every visitor before a byte of the page is
    // sent. Wrapping it grew that bundle to catch errors in a file that does
    // two synchronous array scans and, for admins only, one HMAC check. Not a
    // trade worth making; server and client reporting are unaffected.
    autoInstrumentMiddleware: false,
    treeshake: { removeDebugLogging: true },
  },
  // Strips the parts of the SDK this site does not use. Session Replay is not
  // enabled, so none of its DOM, iframe or worker code needs shipping.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
})
