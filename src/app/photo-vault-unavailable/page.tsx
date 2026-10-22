import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '@/components/ui/PageHero'
import { btnPrimary, btnOutline } from '@/lib/ui'

// Shown in place of the Photo Vault while it is switched off
// (PHOTO_VAULT_PUBLISHED in src/lib/launch.ts). The middleware rewrites every
// /photo-vault address to this page and answers 503 with Retry-After, so search
// engines treat the pause as temporary. noindex as well: this page must never
// be indexed as if it were the Photo Vault.
export const metadata: Metadata = {
  title: 'Photo Vault',
  robots: { index: false, follow: false },
}

export default function PhotoVaultUnavailablePage() {
  return (
    <>
      <PageHero title="Photo Vault" subtitle="Taking a short break" />
      <div className="py-20">
        <div className="max-w-xl mx-auto px-4 text-center">
          <p className="text-charcoal-600 text-lg mb-3">
            The BILD Photo Vault is temporarily unavailable.
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
