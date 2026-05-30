'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { X, Camera } from 'lucide-react'
import photosData from '@/data/photos.json'
import { Photo } from '@/lib/types'
import PageHero from '@/components/ui/PageHero'

function PhotoVaultContent() {
  const searchParams = useSearchParams()
  const initialEvent = searchParams.get('event') ?? 'all'
  const [activeEvent, setActiveEvent] = useState(initialEvent)
  const [lightbox, setLightbox] = useState<Photo | null>(null)

  const photos = photosData.photos as Photo[]
  const events = useMemo(() => {
    const unique = Array.from(new Set(photos.map(p => p.eventSlug)))
    return unique.map(slug => ({ slug, title: photos.find(p => p.eventSlug === slug)!.eventTitle }))
  }, [photos])

  const filtered = activeEvent === 'all' ? photos : photos.filter(p => p.eventSlug === activeEvent)

  return (
    <>
      <PageHero title="Photo Vault" subtitle="Memories from BILD events and celebrations" />
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            <button
              onClick={() => setActiveEvent('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeEvent === 'all' ? 'bg-gold-500 text-white' : 'bg-gold-100 text-charcoal-700 hover:bg-gold-200'}`}
            >
              All Events
            </button>
            {events.map(e => (
              <button
                key={e.slug}
                onClick={() => setActiveEvent(e.slug)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeEvent === e.slug ? 'bg-gold-500 text-white' : 'bg-gold-100 text-charcoal-700 hover:bg-gold-200'}`}
              >
                {e.title}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera size={36} className="text-gold-500" />
              </div>
              <h3 className="font-display text-2xl font-bold text-charcoal-800 mb-3">Photos coming soon</h3>
              <p className="text-charcoal-500 max-w-sm mx-auto">
                We&apos;re building our photo library. Check back after our next event to see the memories we&apos;ve made together.
              </p>
            </div>
          ) : (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
              {filtered.map(photo => (
                <div
                  key={photo.id}
                  className="break-inside-avoid cursor-pointer rounded-xl overflow-hidden bg-charcoal-700 hover:opacity-90 transition-opacity"
                  onClick={() => setLightbox(photo)}
                >
                  <div className="w-full bg-gradient-to-br from-charcoal-600 to-charcoal-800 flex items-center justify-center"
                    style={{ aspectRatio: `${photo.width}/${photo.height}` }}>
                    <span className="text-white/20 font-display font-bold text-3xl">BILD</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white hover:text-gold-400 transition-colors">
            <X size={28} />
          </button>
          <div
            className="max-w-4xl w-full bg-charcoal-800 rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full bg-gradient-to-br from-charcoal-600 to-charcoal-900 flex items-center justify-center h-96">
              <span className="text-white/20 font-display font-bold text-6xl">BILD</span>
            </div>
            <p className="p-4 text-gray-300 text-sm">{lightbox.alt}</p>
          </div>
        </div>
      )}
    </>
  )
}

export default function PhotoVaultPage() {
  return (
    <Suspense>
      <PhotoVaultContent />
    </Suspense>
  )
}
