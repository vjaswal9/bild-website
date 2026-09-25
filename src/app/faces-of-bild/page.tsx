import type { Metadata } from 'next'
import { FaInstagram } from 'react-icons/fa'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import InstagramEmbed from '@/components/faces/InstagramEmbed'
import { SITE_CONFIG } from '@/data/config'
import { getGoogleReviews } from '@/lib/google-reviews'
import { getActiveReels } from '@/lib/faces-reels-server'

export const metadata: Metadata = {
  // The section's real name - opt out of the '| BILD' template rather
  // than shortening it, so the brand name stays intact.
  title: { absolute: 'Faces of BILD' },
  description: 'Photos, reels and stories from the BILD community - British Indians connecting, celebrating and building friendships across Dubai and the UAE.',
}
// The reels and the Google rating are the same for every visitor and change
// when an admin adds one, not per request. force-no-store also overrode the
// 24 hour cache on the Google Places call, so every visit paid for a live API
// round trip before the first byte.
export const revalidate = 300

export default async function FacesOfBildPage() {
  const reels = await getActiveReels()
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero
        title="Faces of BILD"
        subtitle="The people, stories and moments that make our community"
      >
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>
      <div className="py-12 bg-gradient-to-br from-charcoal-900 via-[#1a1208] to-[#15100a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {reels.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaInstagram size={36} className="text-gold-400" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white mb-3">Coming soon</h2>
              <p className="text-gray-400 max-w-md mx-auto mb-8">
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
                <div key={reel.id} className="w-full sm:w-[340px] border border-charcoal-700 rounded-2xl p-5">
                  {(reel.name || reel.caption) && (
                    <div className="mb-3 text-center">
                      {reel.name && <p className="font-display text-xl font-bold text-white">{reel.name}</p>}
                      {reel.caption && <p className="text-base text-gray-400 mt-1">{reel.caption}</p>}
                    </div>
                  )}
                  <InstagramEmbed url={reel.url} />
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
