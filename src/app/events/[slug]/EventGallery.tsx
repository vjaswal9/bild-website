import { GalleryItem } from '@/lib/events'
import InstagramEmbed from '@/components/faces/InstagramEmbed'

export default function EventGallery({ items }: { items: GalleryItem[] }) {
  const media = items.filter(item => item.type !== 'instagram')
  const posts = items.filter(item => item.type === 'instagram')

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-6">Photos &amp; Videos</h2>
      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-charcoal-900 aspect-square">
              {item.type === 'video' ? (
                <video src={item.url} controls className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={`Event photo ${i + 1}`} className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}
      {posts.length > 0 && (
        <div className="flex flex-col items-center gap-6 mt-6">
          {posts.map((item, i) => (
            <InstagramEmbed key={i} url={item.url} />
          ))}
        </div>
      )}
    </div>
  )
}
