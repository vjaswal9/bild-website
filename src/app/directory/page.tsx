'use client'

import { useState, useMemo } from 'react'
import { Search, Globe, Phone, Mail, Share2, CheckCircle } from 'lucide-react'
import businessesData from '@/data/businesses.json'
import { Business } from '@/lib/types'
import SectionHeading from '@/components/ui/SectionHeading'
import { SITE_CONFIG } from '@/data/config'

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function DirectoryPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const debouncedSearch = useDebounce(search, 300)

  const businesses = businessesData.businesses as Business[]
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(businesses.map(b => b.category)))],
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
    <div className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Business Directory"
          subtitle="Find and support British Indian businesses across the UAE"
        />

        <div className="max-w-xl mx-auto mb-6">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search businesses, owners, or locations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-400 text-charcoal-800 bg-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? 'bg-saffron-500 text-white' : 'bg-gray-100 text-charcoal-700 hover:bg-gray-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-charcoal-500 text-lg mb-2">No businesses found.</p>
            <p className="text-charcoal-400 text-sm">
              Are you a BILD member with a business?{' '}
              <a href={`mailto:${SITE_CONFIG.contactEmail}?subject=Business Directory Listing`} className="text-saffron-600 hover:underline">
                Contact us to list your business.
              </a>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(biz => (
              <div key={biz.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-charcoal-800 text-lg leading-tight">{biz.name}</h3>
                    <p className="text-sm text-charcoal-500">{biz.ownerName}</p>
                  </div>
                  {biz.isVerified && (
                    <CheckCircle size={18} className="text-saffron-500 shrink-0 mt-1" aria-label="Verified BILD member" />
                  )}
                </div>

                <span className="inline-block bg-saffron-50 text-saffron-700 text-xs font-medium px-3 py-1 rounded-full mb-3">
                  {biz.category}
                </span>

                <p className="text-sm text-charcoal-600 mb-4 leading-relaxed">{biz.description}</p>

                <p className="text-xs text-gray-400 mb-4">{biz.location}</p>

                <div className="flex gap-3 flex-wrap">
                  {biz.contactEmail && (
                    <a href={`mailto:${biz.contactEmail}`} className="text-charcoal-500 hover:text-saffron-600 transition-colors" title="Email">
                      <Mail size={16} />
                    </a>
                  )}
                  {biz.contactPhone && (
                    <a href={`tel:${biz.contactPhone}`} className="text-charcoal-500 hover:text-saffron-600 transition-colors" title="Phone">
                      <Phone size={16} />
                    </a>
                  )}
                  {biz.website && (
                    <a href={biz.website} target="_blank" rel="noopener noreferrer" className="text-charcoal-500 hover:text-saffron-600 transition-colors" title="Website">
                      <Globe size={16} />
                    </a>
                  )}
                  {biz.instagram && (
                    <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-charcoal-500 hover:text-saffron-600 transition-colors" title="Instagram">
                      <Share2 size={16} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-16 bg-saffron-50 border border-saffron-200 rounded-2xl p-8 text-center">
          <h3 className="font-display text-xl font-bold text-charcoal-800 mb-2">Are you a BILD member with a business?</h3>
          <p className="text-charcoal-600 mb-4 text-sm">
            Get your business listed in the BILD directory, free for all members.
          </p>
          <a
            href={`mailto:${SITE_CONFIG.contactEmail}?subject=Business Directory Listing Request`}
            className="inline-block bg-saffron-500 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-saffron-600 transition-colors"
          >
            Submit Your Business
          </a>
        </div>
      </div>
    </div>
  )
}
