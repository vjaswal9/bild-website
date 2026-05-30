'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Globe, Phone, Mail, Share2, CheckCircle } from 'lucide-react'

export type DisplayBusiness = {
  id: string
  name: string
  ownerName: string
  category: string
  description: string
  contactEmail?: string
  contactPhone?: string
  website?: string
  instagram?: string
  location: string
  isVerified: boolean
  bildOffer?: string
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function DirectoryClient({ businesses }: { businesses: DisplayBusiness[] }) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const debouncedSearch = useDebounce(search, 300)

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(businesses.map(b => b.category))).sort()],
    [businesses]
  )

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return businesses.filter(b => {
      const matchesSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.ownerName.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q)
      const matchesCategory = activeCategory === 'All' || b.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [businesses, debouncedSearch, activeCategory])

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="max-w-xl mx-auto mb-6">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search businesses, owners, or locations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gold-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 text-charcoal-800 bg-cream"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? 'bg-gold-500 text-white' : 'bg-gold-100 text-charcoal-700 hover:bg-gold-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-charcoal-500 mb-8">
          {filtered.length === businesses.length
            ? `${businesses.length} businesses listed`
            : `${filtered.length} of ${businesses.length} businesses`}
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-charcoal-500 text-lg mb-2">No businesses found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(biz => (
              <div key={biz.id} className="bg-cream rounded-2xl border border-gold-200 shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-charcoal-800 text-lg leading-tight">{biz.name}</h3>
                    <p className="text-sm text-charcoal-500">{biz.ownerName}</p>
                  </div>
                  {biz.isVerified && (
                    <CheckCircle size={18} className="text-gold-500 shrink-0 mt-1" aria-label="Verified BILD member" />
                  )}
                </div>

                <span className="inline-block bg-gold-100 text-gold-700 text-xs font-medium px-3 py-1 rounded-full mb-3 w-fit">
                  {biz.category}
                </span>

                <p className="text-sm text-charcoal-600 mb-3 leading-relaxed flex-1">{biz.description}</p>

                {biz.bildOffer && (
                  <div className="bg-gold-50 border border-gold-200 rounded-lg px-3 py-2 mb-3">
                    <p className="text-xs font-semibold text-gold-700">🎁 BILD Member Offer</p>
                    <p className="text-xs text-charcoal-600 mt-0.5">{biz.bildOffer}</p>
                  </div>
                )}

                <p className="text-xs text-gray-400 mb-4">{biz.location}</p>

                <div className="flex gap-3 flex-wrap">
                  {biz.contactEmail && (
                    <a href={`mailto:${biz.contactEmail}`} className="text-charcoal-500 hover:text-gold-600 transition-colors" title="Email">
                      <Mail size={16} />
                    </a>
                  )}
                  {biz.contactPhone && (
                    <a href={`tel:${biz.contactPhone}`} className="text-charcoal-500 hover:text-gold-600 transition-colors" title="Phone">
                      <Phone size={16} />
                    </a>
                  )}
                  {biz.website && (
                    <a href={biz.website} target="_blank" rel="noopener noreferrer" className="text-charcoal-500 hover:text-gold-600 transition-colors" title="Website">
                      <Globe size={16} />
                    </a>
                  )}
                  {biz.instagram && (
                    <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-charcoal-500 hover:text-gold-600 transition-colors" title="Instagram">
                      <Share2 size={16} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-16 bg-charcoal-800 rounded-2xl p-8 text-center">
          <h3 className="font-display text-xl font-bold text-white mb-2">Are you a BILD member with a business?</h3>
          <p className="text-gray-300 mb-5 text-sm">Get your business listed in the BILD directory, free for all members.</p>
          <Link href="/directory/submit"
            className="inline-block bg-gold-500 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-gold-600 transition-colors">
            Submit Your Business
          </Link>
        </div>
      </div>
    </div>
  )
}
