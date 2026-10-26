import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '@/components/ui/PageHero'
import { btnPrimary, btnOutline } from '@/lib/ui'
import { LISTING_GRACE_LABEL } from '@/lib/featured-copy'

// Shown in place of the Business Directory while it is switched off
// (DIRECTORY_PUBLISHED in src/lib/launch.ts). The middleware rewrites every
// public directory address to this page and answers 503 with Retry-After, so
// search engines treat the pause as temporary. noindex as well: this page must
// never be indexed as if it were the directory.
export const metadata: Metadata = {
  title: 'Business Directory',
  robots: { index: false, follow: false },
}

export default function DirectoryUnavailablePage() {
  return (
    <>
      <PageHero title="Business Directory" subtitle="Taking a short break" />
      <div className="py-20">
        <div className="max-w-xl mx-auto px-4 text-center">
          <p className="text-charcoal-600 text-lg mb-3">
            The BILD Business Directory is temporarily offline while we make some enhancements.
          </p>
          <p className="text-charcoal-600 mb-3">
            As a goodwill gesture, every listing, new or existing, is free until {LISTING_GRACE_LABEL}.
          </p>
          <p className="text-charcoal-600 mb-10">
            It will be back soon. In the meantime, you can see what is on at BILD or get in touch.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/events" className={`${btnPrimary} px-8 py-4 text-lg`}>
              See events
            </Link>
            <Link href="/contact" className={`${btnOutline} px-8 py-4 text-lg`}>
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
