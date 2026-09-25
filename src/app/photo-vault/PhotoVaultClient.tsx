'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { X, Camera, Play } from 'lucide-react'
import { formatMonthYear } from '@/lib/utils'
import InstagramEmbed from '@/components/faces/InstagramEmbed'
import ModalPortal from '@/components/ui/ModalPortal'

export type VaultItem = {
  id: string
  url: string
  type: 'image' | 'video'
  eventSlug: string
  eventTitle: string
}
type EventOpt = { slug: string; title: string; date: string }
type InstagramPost = { id: string; url: string; eventSlug: string; eventTitle: string }

function PhotoVaultInner({ items, events, instagramPosts }: { items: VaultItem[]; events: EventOpt[]; instagramPosts: InstagramPost[] }) {
  const searchParams = useSearchParams()
  const initial = searchParams.get('event') ?? 'all'
  const [activeEvent, setActiveEvent] = useState(events.some(e => e.slug === initial) ? initial : 'all')
  const [lightbox, setLightbox] = useState<VaultItem | null>(null)

  const filtered = activeEvent === 'all' ? items : items.filter(i => i.eventSlug === activeEvent)
  const filteredPosts = activeEvent === 'all' ? instagramPosts : instagramPosts.filter(p => p.eventSlug === activeEvent)

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {events.length > 1 && (
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            <Chip active={activeEvent === 'all'} onClick={() => setActiveEvent('all')}>All Events</Chip>
            {events.map(e => (
              <Chip key={e.slug} active={activeEvent === e.slug} onClick={() => setActiveEvent(e.slug)}>
                {e.title} · {formatMonthYear(e.date)}
              </Chip>
            ))}
          </div>
        )}

        {filteredPosts.length > 0 && (
          <div className="mb-14">
            <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-6 text-center">Instagram Posts</h2>
            <div className="flex flex-wrap justify-center gap-6">
              {filteredPosts.map(post => (
                <div key={post.id} className="flex flex-col items-center gap-2">
                  <InstagramEmbed url={post.url} />
                  <p className="text-charcoal-500 text-xs">{post.eventTitle}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          filteredPosts.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera size={36} className="text-gold-500" />
              </div>
              <h3 className="font-display text-2xl font-bold text-charcoal-800 mb-3">Photos coming soon</h3>
              <p className="text-charcoal-500 max-w-sm mx-auto">
                We&apos;re building our photo library. Check back after our next event to see the memories we&apos;ve made together.
              </p>
            </div>
          )
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
            {filtered.map(item => (
              <button
                key={item.id}
                onClick={() => setLightbox(item)}
                className="block w-full break-inside-avoid mb-4 rounded-xl overflow-hidden bg-charcoal-800 relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2"
              >
                {item.type === 'video' ? (
                  <>
                    <video src={item.url} muted playsInline preload="metadata" className="w-full block" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                      <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <Play size={20} className="text-charcoal-800 fill-charcoal-800 ml-0.5" />
                      </span>
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={`${item.eventTitle} photo`} loading="lazy" className="w-full block group-hover:opacity-90 transition-opacity" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <ModalPortal onClose={() => setLightbox(null)}>
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`${lightbox.eventTitle} photo`}
            onClick={() => setLightbox(null)}
          >
            <button className="absolute top-4 right-4 text-white hover:text-gold-400 transition-colors" aria-label="Close" onClick={() => setLightbox(null)}>
              <X size={28} />
            </button>
            <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
              {lightbox.type === 'video' ? (
                <video src={lightbox.url} controls autoPlay playsInline className="w-full max-h-[80vh] rounded-xl bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lightbox.url} alt={`${lightbox.eventTitle} photo`} className="w-full max-h-[80vh] object-contain rounded-xl" />
              )}
              <p className="text-gray-300 text-sm mt-3 text-center">{lightbox.eventTitle}</p>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        active ? 'bg-gold-500 text-white' : 'bg-gold-100 text-charcoal-700 hover:bg-gold-200'
      }`}
    >
      {children}
    </button>
  )
}

export default function PhotoVaultClient(props: { items: VaultItem[]; events: EventOpt[]; instagramPosts: InstagramPost[] }) {
  return (
    <Suspense>
      <PhotoVaultInner {...props} />
    </Suspense>
  )
}
