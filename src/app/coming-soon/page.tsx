import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '@/components/ui/PageHero'
import { btnPrimary, btnOutline } from '@/lib/ui'

// noindex: this placeholder is also rewritten onto not-yet-live URLs during the
// soft launch, so search engines shouldn't index any of them as thin pages.
export const metadata: Metadata = { title: 'Coming Soon', robots: { index: false, follow: false } }

export default function ComingSoonPage() {
  return (
    <>
      <PageHero title="Coming Soon" subtitle="We're putting the finishing touches on this part of BILD" />
      <div className="py-20">
        <div className="max-w-xl mx-auto px-4 text-center">
          <p className="text-charcoal-600 text-lg mb-3">
            This section is on its way and will be available shortly.
          </p>
          <p className="text-charcoal-500 mb-10">
            In the meantime, come and be part of the community, or head back to the home page.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/join" className={`${btnPrimary} px-8 py-4 text-lg`}>
              Join BILD ⭐
            </Link>
            <Link href="/" className={`${btnOutline} px-8 py-4 text-lg`}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
