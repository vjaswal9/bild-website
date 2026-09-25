import { withSentryConfig } from '@sentry/nextjs/config'

/** @type {import('next').NextConfig} */
const nextConfig = {
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
