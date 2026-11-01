import Image from 'next/image'
import Link from 'next/link'
import { btnPrimary } from '@/lib/ui'

// A banner on the events page for the Mahjong interest register. It sits
// between upcoming and past events so it never pushes a bookable event down.
export default function MahjongPromo() {
  return (
    <section className="mb-16" aria-labelledby="mahjong-promo-heading">
      <div className="rounded-2xl bg-charcoal-900 border border-gold-500/40 overflow-hidden grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] items-center">
        <Link href="/mahjong" className="block bg-charcoal-900 p-4 sm:p-5" aria-label="Open the Mahjong interest form">
          <Image
            src="/images/mahjong/bild-mahjong-flyer.png"
            alt="BILD Mahjong flyer"
            width={1080}
            height={1350}
            className="w-44 sm:w-full mx-auto rounded-lg shadow-lg"
            sizes="220px"
          />
        </Link>
        <div className="p-6 sm:p-8 text-center sm:text-left">
          <p className="text-xs font-semibold tracking-widest text-gold-400 uppercase mb-2">Something new for our BILD family</p>
          <h2 id="mahjong-promo-heading" className="font-display text-2xl sm:text-3xl font-bold text-white mb-3">
            A little Mahjong. A lot of connection.
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6 max-w-xl">
            We are exploring Mahjong classes and regular socials for the BILD community. Register your interest and we
            will message you on WhatsApp once dates, venues and prices are confirmed. No payment, no commitment.
          </p>
          <Link href="/mahjong" className={`${btnPrimary} px-7 py-3.5 text-base`}>Register your interest</Link>
        </div>
      </div>
    </section>
  )
}
