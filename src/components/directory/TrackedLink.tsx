'use client'

import { useCallback } from 'react'
import type { EventKind } from '@/lib/directory-stats'

// An outbound link on a business profile that reports the click.
//
// The report must never get in the way of the click itself. sendBeacon hands
// the request to the browser, which delivers it even as the page is being
// unloaded or replaced by the phone dialler - a plain fetch is frequently
// cancelled at exactly that moment, which is why click tracking on tel: links
// so often under-reports. fetch with keepalive is the fallback, and if both are
// unavailable the link simply works and nothing is counted.
export default function TrackedLink({
  businessId, kind, href, children, className, target, rel, title, 'aria-label': ariaLabel,
}: {
  businessId: string
  kind: Exclude<EventKind, 'view'>
  href: string
  children: React.ReactNode
  className?: string
  target?: string
  rel?: string
  title?: string
  'aria-label'?: string
}) {
  const report = useCallback(() => {
    try {
      const body = JSON.stringify({ businessId, kind })
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
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
      // Never let telemetry break a link.
    }
  }, [businessId, kind])

  return (
    <a
      href={href}
      className={className}
      target={target}
      rel={rel}
      title={title}
      aria-label={ariaLabel}
      onClick={report}
      // Covers opening in a new tab via the middle button, which fires no click.
      onAuxClick={e => { if (e.button === 1) report() }}
    >
      {children}
    </a>
  )
}
