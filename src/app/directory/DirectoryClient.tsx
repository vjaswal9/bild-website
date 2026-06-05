'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Search, Globe, Phone, Mail, Share2, CheckCircle, X, MapPin, Star } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import BusinessAvatar from '@/components/directory/BusinessAvatar'

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
  logoUrl?: string
  memberSince?: string
}

type SortKey = 'name' | 'category' | 'newest'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function waLink(phone: string) {
  const digits = phone.replace(/[^\d]/g, '')
  return `https://wa.me/${digits}`
}

function BusinessCard({ biz }: { biz: DisplayBusiness }) {
  return (
    <div className="bg-cream rounded-2xl border border-gold-200 shadow-sm p-6 hover:shadow-md hover:border-gold-300 transition-all flex flex-col">
      <div className="flex items-start gap-4 mb-3">
        <BusinessAvatar name={biz.name} logoUrl={biz.logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-charcoal-800 text-lg leading-tight truncate">{biz.name}</h3>
            {biz.isVerified && (
              <CheckCircle size={15} className="text-gold-500 shrink-0" aria-label="Verified BILD member" />
            )}
          </div>
          <p className="text-sm text-charcoal-500 truncate">{biz.ownerName}</p>
          <span className="inline-block bg-gold-100 text-gold-700 text-xs font-medium px-2.5 py-0.5 rounded-full mt-1.5">
            {biz.category}
          </span>
        </div>
      </div>

      <p className="text-sm text-charcoal-600 mb-3 leading-relaxed flex-1">{biz.description}</p>

      {biz.bildOffer && (
        <div className="bg-gold-50 border border-gold-200 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs font-semibold text-gold-700">🎁 BILD Member Offer</p>
          <p className="text-xs text-charcoal-600 mt-0.5">{biz.bildOffer}</p>
        </div>
      )}

      <p className="flex items-center gap-1 text-xs text-charcoal-400 mb-4">
        <MapPin size={12} /> {biz.location}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        {biz.contactPhone && (
          <a
            href={waLink(biz.contactPhone)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#1da851] transition-colors"
          >
            <FaWhatsapp size={14} /> WhatsApp
          </a>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {biz.contactEmail && (
            <a href={`mailto:${biz.contactEmail}`} className="text-charcoal-400 hover:text-gold-600 transition-colors" title="Email">
              <Mail size={16} />
            </a>
          )}
          {biz.contactPhone && (
            <a href={`tel:${biz.contactPhone}`} className="text-charcoal-400 hover:text-gold-600 transition-colors" title="Call">
              <Phone size={16} />
            </a>
          )}
          {biz.website && (
            <a href={biz.website} target="_blank" rel="noopener noreferrer" className="text-charcoal-400 hover:text-gold-600 transition-colors" title="Website">
              <Globe size={16} />
            </a>
          )}
          {biz.instagram && (
            <a href={`https://instagram.com/${biz.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-charcoal-400 hover:text-gold-600 transition-colors" title="Instagram">
              <Share2 size={16} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DirectoryClient({ businesses }: { businesses: DisplayBusiness[] }) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sort, setSort] = useState<SortKey>('name')
  const debouncedSearch = useDebounce(search, 300)

  // Category list with counts
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    businesses.forEach(b => counts.set(b.category, (counts.get(b.category) || 0) + 1))
    const sorted = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    return [{ name: 'All', count: businesses.length }, ...sorted.map(([name, count]) => ({ name, count }))]
  }, [businesses])

  // Featured = verified, shown only with no active search/filter
  const featured = useMemo(
    () => businesses.filter(b => b.isVerified).slice(0, 3),
    [businesses]
  )

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    const list = businesses.filter(b => {
      const matchesSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.ownerName.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
      const matchesCategory = activeCategory === 'All' || b.category === activeCategory
      return matchesSearch && matchesCategory
    })

    return list.sort((a, b) => {
      if (sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
      if (sort === 'newest') return (b.memberSince || '').localeCompare(a.memberSince || '')
      return a.name.localeCompare(b.name)
    })
  }, [businesses, debouncedSearch, activeCategory, sort])

  const isFiltering = activeCategory !== 'All' || debouncedSearch.trim() !== ''

  function clearFilters() {
    setSearch('')
    setActiveCategory('All')
  }

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Featured strip — only when not filtering */}
        {!isFiltering && featured.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <Star size={18} className="text-gold-500 fill-gold-500" />
              <h2 className="font-display text-xl font-bold text-charcoal-800">Featured Members</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map(biz => <BusinessCard key={`feat-${biz.id}`} biz={biz} />)}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="max-w-xl mx-auto mb-6">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search businesses, owners, categories, or locations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gold-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 text-charcoal-800 bg-cream"
            />
          </div>
        </div>

        {/* Category pills with counts */}
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {categories.map(cat => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat.name ? 'bg-gold-500 text-white' : 'bg-gold-100 text-charcoal-700 hover:bg-gold-200'}`}
            >
              {cat.name} <span className="opacity-60">({cat.count})</span>
            </button>
          ))}
        </div>

        {/* Result count + sort + clear */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <p className="text-sm text-charcoal-500">
            {filtered.length === businesses.length
              ? `${businesses.length} businesses listed`
              : `${filtered.length} of ${businesses.length} businesses`}
          </p>
          {isFiltering && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 text-sm text-gold-600 hover:text-gold-700 font-medium">
              <X size={14} /> Clear filters
            </button>
          )}
          <div className="sm:ml-auto flex items-center gap-2">
            <label className="text-sm text-charcoal-500">Sort:</label>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="text-sm border border-gold-200 rounded-lg px-3 py-1.5 bg-cream text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-gold-400"
            >
              <option value="name">Name (A to Z)</option>
              <option value="category">Category</option>
              <option value="newest">Newest members</option>
            </select>
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-charcoal-500 text-lg mb-2">
              No businesses found{activeCategory !== 'All' ? ` in ${activeCategory}` : ''}.
            </p>
            <button onClick={clearFilters} className="text-gold-600 hover:underline text-sm font-medium">
              Clear filters and view all
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(biz => <BusinessCard key={biz.id} biz={biz} />)}
          </div>
        )}

        {/* Get listed CTA */}
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
