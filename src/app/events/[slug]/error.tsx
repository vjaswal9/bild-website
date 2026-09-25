'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { btnPrimary } from '@/lib/ui'

// Shown when an event page could not be loaded, as opposed to an event that
// does not exist. The difference matters to the person looking at it: a 404
// tells them the event is gone, which is how a buyer came to think a live
// event had sold out. This tells them the truth, which is to try again.
export default function EventLoadError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ slug: string }>()

  // This boundary sits on the ticket-buying funnel, so a failure here is
  // somebody unable to give BILD money.
  //
  // Browser-side Sentry was removed for bundle size, so this logs rather than
  // reports. The slug and the digest are both included on purpose: the digest
  // matches the server's own log line for the same failure, and the server
  // side of this page still reports to Sentry in full, so the failure is not
  // invisible, only its browser half is.
  useEffect(() => {
    console.error(
      'Event page could not be loaded:', error,
      'slug:', params?.slug ?? 'unknown',
      'digest:', error.digest ?? 'none',
    )
  }, [error, params?.slug])

  return (
    <div className="py-24">
      <div className="max-w-lg mx-auto px-4 text-center">
        <h1 className="font-display text-3xl font-bold text-charcoal-800 mb-3">We could not load this event</h1>
        <p className="text-charcoal-600 mb-8 leading-relaxed">
          This is a temporary problem on our side, not a sold out event. Please try again in a moment. If it keeps
          happening, email <a href="mailto:events@bild.ae" className="text-gold-600 font-medium hover:underline">events@bild.ae</a> and
          we will book you in.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button onClick={() => reset()} className={`${btnPrimary} px-6 py-3`}>
            <RefreshCw size={17} /> Try again
          </button>
          <Link href="/events" className="text-charcoal-600 font-medium hover:underline">
            See all events
          </Link>
        </div>
      </div>
    </div>
  )
}
