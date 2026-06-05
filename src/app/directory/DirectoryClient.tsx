'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Search, Globe, Phone, Mail, Share2, CheckCircle, X, MapPin, ChevronDown, CalendarDays, ShieldCheck, Briefcase, Crown } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import BusinessAvatar from '@/components/directory/BusinessAvatar'

function formatMemberSince(ym?: string) {
  if (!ym) return null
  const [y, m] = ym.split('-')
  if (!y) return null
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const monthName = m ? months[parseInt(m, 10) - 1] : ''
  return monthName ? `${monthName} ${y}` : y
}

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
  tagline?: string
  establishedYear?: string
  licenceVerified?: boolean
  featured?: boolean
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

function BusinessCard({ biz, featured = false }: { biz: DisplayBusiness; featured?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = biz.description.length > 120
  const memberSince = formatMemberSince(biz.memberSince)

  return (
    <div className={`relative rounded-2xl p-6 flex flex-col transition-all ${
      featured
        ? 'bg-white ring-2 ring-gold-400 shadow-lg hover:shadow-xl'
        : 'bg-cream border border-gold-200 shadow-sm hover:shadow-md hover:border-gold-300'
    }`}>
      {featured && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 bg-gold-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md">
          <Crown size={12} className="fill-white" /> Featured
        </span>
      )}
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

      {/* Tagline hook */}
      {biz.tagline && (
        <p className="text-sm font-medium text-charcoal-700 mb-2 leading-snug">{biz.tagline}</p>
      )}

      {/* Trust badges */}
      {(biz.licenceVerified || biz.establishedYear) && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {biz.licenceVerified && (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-full">
              <ShieldCheck size={12} /> Licence verified
            </span>
          )}
          {biz.establishedYear && (
            <span className="inline-flex items-center gap-1 text-xs text-charcoal-500">
              <Briefcase size={12} className="text-gold-500" /> Trading since {biz.establishedYear}
            </span>
          )}
        </div>
      )}

      <p className={`text-sm text-charcoal-600 mb-1 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
        {biz.description}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="self-start inline-flex items-center gap-1 text-xs font-semibold text-gold-600 hover:text-gold-700 mb-3"
        >
          {expanded ? 'Show less' : 'Read more'}
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      {!isLong && <div className="mb-3" />}

      {biz.bildOffer && (
        <div className="bg-gold-50 border border-gold-200 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs font-semibold text-gold-700">🎁 BILD Member Offer</p>
          <p className="text-xs text-charcoal-600 mt-0.5">{biz.bildOffer}</p>
        </div>
      )}

      {/* Member-since revealed when expanded */}
      {expanded && memberSince && (
        <p className="flex items-center gap-1.5 text-xs text-charcoal-500 mb-2">
          <CalendarDays size={12} className="text-gold-500" /> BILD member since {memberSince}
        </p>
      )}

      <p className="flex items-center gap-1 text-xs text-charcoal-400 mb-4 mt-auto">
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

  // Featured = explicitly featured by admin; falls back to first verified if none set
  const featured = useMemo(() => {
    const chosen = businesses.filter(b => b.featured)
    if (chosen.length > 0) return chosen.slice(0, 6)
    return businesses.filter(b => b.isVerified).slice(0, 3)
  }, [businesses])

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

        {/* Top CTA banner — list your business */}
        <div className="mb-12 bg-charcoal-800 rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-white mb-1">Own a business? Get listed for free</h2>
            <p className="text-gray-300 text-sm">
              The BILD Business Directory is exclusively for members. Add your business in minutes and reach 2,000+ British Indians across the UAE.
            </p>
          </div>
          <Link
            href="/directory/submit"
            className="shrink-0 bg-gold-500 text-white px-7 py-3 rounded-lg font-semibold hover:bg-gold-600 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Submit Your Business
          </Link>
        </div>

        {/* Featured spotlight — only when not filtering */}
        {!isFiltering && featured.length > 0 && (
          <div className="relative mb-16 bg-charcoal-900 rounded-3xl px-6 py-10 sm:px-10 sm:py-12 overflow-hidden">
            {/* Gold glow accents */}
            <div
              className="absolute top-0 right-0 w-72 h-72 rounded-full blur-[110px] opacity-20 -translate-y-1/3 translate-x-1/4"
              style={{ background: 'radial-gradient(circle, #C8861A 0%, transparent 70%)' }}
            />
            <div
              className="absolute bottom-0 left-0 w-60 h-60 rounded-full blur-[100px] opacity-15 translate-y-1/3 -translate-x-1/4"
              style={{ background: 'radial-gradient(circle, #E0A135 0%, transparent 70%)' }}
            />

            <div className="relative z-10">
              <div className="text-center mb-9">
                <span className="inline-flex items-center gap-2 bg-gold-500/15 text-gold-400 border border-gold-500/30 px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-widest">
                  <Crown size={16} className="fill-gold-400" /> Featured Members
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-white mt-4">
                  Our spotlight businesses
                </h2>
                <p className="text-gray-400 mt-2 max-w-lg mx-auto">
                  Hand-picked, trusted businesses from across the BILD community.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featured.map(biz => <BusinessCard key={`feat-${biz.id}`} biz={biz} featured />)}
              </div>
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

        {/* Light closing reminder */}
        <p className="mt-14 text-center text-sm text-charcoal-500">
          Are you a BILD member with a business?{' '}
          <Link href="/directory/submit" className="text-gold-600 font-semibold hover:underline">
            Get listed for free
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
