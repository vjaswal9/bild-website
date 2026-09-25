'use client'

import { useEffect } from 'react'

// The last line of defence.
//
// An error thrown while rendering the root layout, or anywhere without a
// closer error.tsx, is not caught by any boundary in the app. Until this file
// existed such an error showed the default Next.js page and produced no Sentry
// event at all, so the most serious class of failure the site can have was
// also the only one nobody was told about.
//
// This file replaces the whole document when it renders, which is why it has
// to carry its own <html> and <body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Browser-side Sentry was deliberately removed: its SDK was 113 KB on every
  // page, which was the single largest thing the site shipped, and the
  // decision was that the bytes mattered more than browser error reports.
  //
  // So this logs instead. The digest is the important part: it is printed by
  // the server for the same failure, so it is the one thing that ties a
  // visitor's report of "it broke" to a line in the Vercel runtime logs.
  // Server-side errors are still reported to Sentry in full.
  useEffect(() => {
    console.error('Unhandled application error:', error, 'digest:', error.digest ?? 'none')
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fdf8f0', color: '#1a1a1a' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ lineHeight: 1.6, color: '#57534e', marginBottom: 32 }}>
            This is a problem on our side and we have been told about it automatically. Please try again in a
            moment. If you were in the middle of paying, nothing has been charged twice, and you can email{' '}
            <a href="mailto:connect@bild.ae" style={{ color: '#C8861A', fontWeight: 500 }}>connect@bild.ae</a>{' '}
            and we will sort it out.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#C8861A', color: '#fff', border: 0, borderRadius: 12,
              padding: '14px 28px', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
