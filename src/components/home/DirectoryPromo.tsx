import Link from 'next/link'
import { Check, Star } from 'lucide-react'
import Reveal from '@/components/anim/Reveal'
import { btnPrimary } from '@/lib/ui'

// The directory is a paid product, not a member perk, and it is open to
// businesses that are not BILD members at all. It needs its own pitch and its
// own prices on the homepage rather than a single line inside "Why Join".
const standardPoints = [
  'Your own profile page in the BILD Business Directory',
  'Logo, banner, contact details, website and social links',
  'Your Google rating and reviews shown on your profile',
  'One member offer, promoted to the BILD community',
  'Searchable by category across the UAE and UK',
]

export default function DirectoryPromo() {
  return (
    <section className="py-20 bg-gold-50 border-t border-gold-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        <Reveal className="text-center mb-12">
          <span className="inline-block bg-gold-500/15 text-gold-700 border border-gold-300 text-sm font-semibold px-4 py-1.5 rounded-full mb-4 tracking-wide uppercase">
            For Businesses
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-charcoal-800 mb-4">
            Put your business in front of the BILD community
          </h2>
          <p className="text-charcoal-600 text-lg max-w-2xl mx-auto leading-relaxed">
            2,000+ British Indians across the UAE, and a community that actively looks for its own when it needs
            a lawyer, a mortgage, a caterer or a contractor. You do not have to be a BILD member to list.
          </p>
        </Reveal>

        <Reveal className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch mb-10" stagger={0.12} y={28}>

          {/* Standard */}
          <div className="flex flex-col bg-white rounded-2xl border border-gold-200 p-8 shadow-sm">
            <h3 className="font-display text-2xl font-bold text-charcoal-800">Standard Listing</h3>
            <p className="text-charcoal-500 text-sm mt-1 mb-5">Everything you need to be found.</p>

            <div className="border-t border-gold-100 pt-5 mb-5" />

            <ul className="space-y-2.5 mb-6 flex-1">
              {standardPoints.map(point => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-charcoal-600">
                  <Check size={16} className="text-gold-600 shrink-0 mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>

            <Link href="/directory/submit" className={`${btnPrimary} w-full justify-center py-3`}>
              List your business
            </Link>
          </div>

          {/* Featured */}
          <div className="flex flex-col bg-charcoal-800 rounded-2xl border border-gold-500/40 p-8 shadow-lg relative">
            <span className="absolute -top-3 left-8 bg-gold-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              Most visible
            </span>
            <h3 className="font-display text-2xl font-bold text-white flex items-center gap-2">
              <Star size={20} className="fill-gold-400 text-gold-400" />
              Featured Listing
            </h3>
            <p className="text-gray-400 text-sm mt-1 mb-5">Top of the directory, and a far bigger profile.</p>

            <div className="border-t border-white/10 pt-5 mb-5">
              <p className="text-xs text-gray-400">Added on top of a Standard Listing, whenever you like.</p>
            </div>

            <ul className="space-y-2.5 mb-6 flex-1">
              <li className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check size={16} className="text-gold-400 shrink-0 mt-0.5" />
                Everything in a Standard Listing
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check size={16} className="text-gold-400 shrink-0 mt-0.5" />
                Gold-highlighted placement, boosted to the top of the directory
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check size={16} className="text-gold-400 shrink-0 mt-0.5" />
                Extended bio, up to 6 extra photos and an embedded video
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check size={16} className="text-gold-400 shrink-0 mt-0.5" />
                Multiple member offers instead of one
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check size={16} className="text-gold-400 shrink-0 mt-0.5" />
                See how many people are viewing your profile
              </li>
            </ul>

            <Link href="/directory/get-featured" className={`${btnPrimary} w-full justify-center py-3`}>
              Get Featured
            </Link>
          </div>

        </Reveal>

        <p className="text-center text-sm text-charcoal-500">
          Submitting a listing is free, and there is a preferential rate for BILD members. Full details are on the{' '}
          <Link href="/directory" className="text-gold-700 font-medium hover:underline">
            Business Directory page
          </Link>
          .
        </p>

      </div>
    </section>
  )
}
