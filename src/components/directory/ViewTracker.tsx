'use client'

import { useEffect, useRef } from 'react'

// Records one profile view, from the browser.
//
// This used to happen during the server render, which forced the whole profile
// page to be dynamic - a full React render on every request, for every visitor
// and every crawler, purely to add 1 to a number. On Vercel's usage-based
// pricing that is the most expensive way imaginable to count something.
//
// Moving it here lets the page be served from the cache. The view is still
// recorded, by a request that does almost nothing, and the same de-duplication
// and rate limiting apply as they do to click tracking.
//
// The trade: a visitor with JavaScript disabled is not counted. That is a
// rounding error, and it has a silver lining - most crawlers that do not run
// JavaScript now drop out of the figures on their own, which makes the numbers
// shown to a paying business more honest, not less.
export default function ViewTracker({ businessId }: { businessId: string }) {
  const done = useRef(false)

  useEffect(() => {
    // React runs effects twice in development. Without this guard the local
    // figures would be double what production records.
    if (done.current) return
    done.current = true

    const body = JSON.stringify({ businessId, kind: 'view' })
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/directory/track', new Blob([body], { type: 'application/json' }))
        return
      }
      fetch('/api/directory/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    } catch {
      // Telemetry must never surface to the visitor.
    }
  }, [businessId])

  return null
}
