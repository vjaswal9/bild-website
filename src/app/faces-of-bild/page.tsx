import type { Metadata } from 'next'
import { FaInstagram } from 'react-icons/fa'
import PageHero from '@/components/ui/PageHero'
import InstagramEmbed from '@/components/faces/InstagramEmbed'
import { SITE_CONFIG } from '@/data/config'
import reelsData from '@/data/reels.json'

export const metadata: Metadata = { title: 'Faces of BILD' }

type Reel = { id: string; url: string; name?: string; caption?: string }

export default function FacesOfBildPage() {
  const reels = (reelsData.reels as Reel[]) || []

  return (
    <>
      <PageHero
        title="Faces of BILD"
        subtitle="The people, stories and moments that make our community"
      />
      <div className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {reels.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaInstagram size={36} className="text-gold-500" />
              </div>
              <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-3">Coming soon</h2>
              <p className="text-charcoal-500 max-w-md mx-auto mb-8">
                We&apos;re putting together a collection of reels celebrating the faces and stories of the BILD community. Follow us on Instagram to see them first.
              </p>
              <a
                href={SITE_CONFIG.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gold-500 text-white px-7 py-3 rounded-lg font-semibold hover:bg-gold-600 transition-all hover:-translate-y-0.5"
              >
                <FaInstagram size={18} /> Follow @bild_ae
              </a>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-6">
              {reels.map(reel => (
                <div key={reel.id} className="w-full sm:w-[340px]">
                  <InstagramEmbed url={reel.url} />
                  {(reel.name || reel.caption) && (
                    <div className="mt-2 text-center">
                      {reel.name && <p className="font-semibold text-charcoal-800">{reel.name}</p>}
                      {reel.caption && <p className="text-sm text-charcoal-500">{reel.caption}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
