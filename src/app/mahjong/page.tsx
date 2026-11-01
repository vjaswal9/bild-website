import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import PageHero from '@/components/ui/PageHero'
import MahjongInterestForm from '@/components/mahjong/MahjongInterestForm'
import { SHOW_MAHJONG_INTEREST } from '@/lib/site-flags'

export const metadata: Metadata = {
  title: 'Mahjong at BILD',
  description:
    'Register your interest in BILD Mahjong classes and socials for British Indians in Dubai. Learn a new game, make new friends. No payment or commitment.',
  // The picture WhatsApp, Instagram and others show when the link is shared.
  // 1200 x 630 and well under 300 KB, which WhatsApp needs to show it.
  openGraph: {
    title: 'Mahjong at BILD',
    description: 'A little Mahjong. A lot of connection. Register your interest in BILD Mahjong classes and socials.',
    url: '/mahjong',
    images: [{ url: '/images/mahjong/bild-mahjong-share.jpg', width: 1200, height: 630, alt: 'BILD Mahjong: a little Mahjong, a lot of connection. Register at bild.ae/mahjong.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mahjong at BILD',
    description: 'A little Mahjong. A lot of connection. Register your interest.',
    images: ['/images/mahjong/bild-mahjong-share.jpg'],
  },
}

export default function MahjongPage() {
  if (!SHOW_MAHJONG_INTEREST) notFound()

  return (
    <>
      <PageHero title="Mahjong at BILD" subtitle="A little Mahjong. A lot of connection." />
      <section className="py-12 sm:py-16 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 lg:gap-14 items-start">
          {/* On a phone the form comes first: that is what people came to do. */}
          <div className="order-2 lg:order-1 lg:sticky lg:top-24">
            <Image
              src="/images/mahjong/bild-mahjong-flyer.png"
              alt="BILD Mahjong flyer: a little Mahjong, a lot of connection. Register your interest at bild.ae/mahjong."
              width={1080}
              height={1350}
              className="w-full max-w-md mx-auto rounded-2xl shadow-xl"
              sizes="(min-width: 1024px) 420px, 90vw"
            />
          </div>

          <div className="order-1 lg:order-2 space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-widest text-gold-700 uppercase mb-2">Something new for our BILD family</p>
              <h2 className="font-display text-3xl font-bold text-charcoal-800 mb-3">Learn a new game, make new friends</h2>
              <p className="text-charcoal-600 leading-relaxed">
                We are exploring Mahjong classes and regular socials for the BILD community. Tell us a little about
                you and we will message you on WhatsApp as soon as dates, venues and prices are confirmed.
              </p>
              <p className="mt-4 rounded-xl bg-gold-50 border border-gold-200 px-4 py-3 text-sm text-charcoal-700">
                There is no payment and no commitment at this stage.
              </p>
            </div>
            <MahjongInterestForm />
            <p className="text-sm text-charcoal-600 text-center">
              Questions, or want your details removed? Email{' '}
              <a href="mailto:events@bild.ae" className="text-gold-700 font-semibold hover:underline">events@bild.ae</a>.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
