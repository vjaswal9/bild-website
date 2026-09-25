import { FaInstagram } from 'react-icons/fa'
import InstagramEmbed from '@/components/faces/InstagramEmbed'
import { parseInstagramHandle, isInstagramPostUrl } from '@/lib/instagram'

/**
 * Instagram presence on a business profile.
 *
 * Instagram only allows embedding an individual post, never a profile feed, so
 * a live feed is not possible. When the business has supplied a specific post
 * link we embed it; otherwise we show a branded follow card, which at least
 * gives the page colour and a route to their photos.
 */
export default function BusinessInstagram({
  instagram, postUrl, businessName,
}: { instagram?: string | null; postUrl?: string | null; businessName: string }) {
  const parsed = instagram ? parseInstagramHandle(instagram) : null
  if (!parsed && !isInstagramPostUrl(postUrl)) return null

  const profileUrl = parsed?.profileUrl || 'https://instagram.com'

  return (
    <div className="mt-8 pt-8 border-t border-gold-100">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="flex items-center gap-2 text-sm font-semibold text-charcoal-700">
          <FaInstagram size={17} className="text-[#E1306C]" /> On Instagram
        </p>
        {parsed && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gold-600 hover:text-gold-700 underline underline-offset-4"
          >
            @{parsed.handle}
          </a>
        )}
      </div>

      {isInstagramPostUrl(postUrl) ? (
        <div className="flex justify-center">
          <InstagramEmbed url={postUrl!} />
        </div>
      ) : (
        // No post link on file: a branded card that still adds colour and sends
        // people to their photos.
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl p-5 text-white transition-transform hover:scale-[1.01]"
          style={{ background: 'linear-gradient(135deg,#833AB4 0%,#E1306C 55%,#F77737 100%)' }}
        >
          <FaInstagram size={34} className="shrink-0" />
          <span className="min-w-0">
            <span className="block font-semibold">See {businessName} on Instagram</span>
            <span className="block text-white/85 text-sm truncate">
              {parsed ? `@${parsed.handle}` : 'View their latest photos and updates'}
            </span>
          </span>
        </a>
      )}
    </div>
  )
}
