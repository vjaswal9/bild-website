'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, MapPin, CheckCircle, Crown, Gift, ArrowRight, ArrowUpRight, Star, X } from 'lucide-react'
import BusinessAvatar from '@/components/directory/BusinessAvatar'
import { GoogleGMark } from '@/components/icons/GoogleLogo'
import { btnPrimary } from '@/lib/ui'
import { formatMemberSince } from '@/lib/format-member-since'
import { LISTING_GRACE_LABEL } from '@/lib/featured-copy'

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
  linkedin?: string
  location: string
  isVerified: boolean
  bildOffer?: string
  logoUrl?: string
  memberSince?: string
  tagline?: string
  establishedYear?: string
  licenceVerified?: boolean
  country?: 'UAE' | 'UK'
  slug?: string
  featured?: boolean
  isBildMember?: boolean
  googleRating?: number
  googleReviewCount?: number
}

export const UK_TRANSACT_WARNING = 'Services delivered in the UK only'

const PAGE_SIZE = 12

// The sidebar in the design shows a short list. There are eighteen live
// categories, and printing all of them makes the sidebar longer than the
// listings beside it, so the quiet tail sits behind one line.
const CATEGORIES_SHOWN = 7

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// Offers are stored as one free-text line, but they read far better with the
// amount pulled out: "50%" set large above "off professional fees" carries from
// across the page in a way a full sentence does not. Anything that does not
// start with a recognisable amount simply keeps its sentence, so no offer is
// mangled to fit the layout.
function splitOffer(offer?: string): { lead: string | null; rest: string } | null {
  if (!offer?.trim()) return null
  const t = offer.trim()
  const pct = t.match(/^(\d+\s*%)\s*/)
  if (pct) return { lead: pct[1].replace(/\s+/g, ''), rest: t.slice(pct[0].length).trim() }
  const word = t.match(/^(Complimentary|Exclusive rates|Exclusive|Free)\b[\s:,-]*/i)
  if (word) return { lead: word[1], rest: t.slice(word[0].length).trim() }
  return { lead: null, rest: t }
}

function whatsappHref(phone?: string) {
  return phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : null
}

const linkUnderline =
  'inline-flex items-center gap-1 underline underline-offset-4 decoration-gold-300 hover:decoration-gold-600 transition-colors'

function OfferLabel({ dark }: { dark?: boolean }) {
  return (
    <p className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] mb-2 ${
      dark ? 'text-gold-400' : 'text-gold-600'
    }`}>
      <Gift size={12} /> BILD member offer
    </p>
  )
}

// `stack` is for the compact row, whose actions column is 150px wide: side by
// side, "WhatsApp" and "Website" overflowed the card and the second one hung
// outside its right edge.
//
// relative z-10 matters: the whole row is a click target for the profile page
// (see ListingRow), and without it these links sit underneath that overlay and
// silently open the profile instead of WhatsApp.
function OutboundLinks({
  biz,
  className = '',
  dark,
  stack,
}: {
  biz: DisplayBusiness
  className?: string
  dark?: boolean
  stack?: boolean
}) {
  const wa = whatsappHref(biz.contactPhone)
  const cls = `${linkUnderline} ${
    dark ? 'text-gray-300 hover:text-gold-400 decoration-gold-500/60' : 'text-charcoal-600 hover:text-gold-700'
  }`
  return (
    <div
      className={`relative z-10 flex text-[13px] ${
        stack ? 'flex-col items-start gap-1' : 'items-center gap-4'
      } ${className}`}
    >
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={cls}>WhatsApp <ArrowUpRight size={12} /></a>}
      {biz.website && <a href={biz.website} target="_blank" rel="noopener noreferrer" className={cls}>Website <ArrowUpRight size={12} /></a>}
    </div>
  )
}

// The separators here used to be literal "|" spans between the items. When the
// row wrapped - which it does on a phone, and on any listing with a long
// location - the pipe stayed behind on the line above as a dangling mark. Each
// item already leads with its own icon, so the icons do the separating and
// there is nothing left to strand.
function MetaLine({ biz, dark }: { biz: DisplayBusiness; dark?: boolean }) {
  const icon = dark ? 'text-gray-400' : 'text-charcoal-400'
  return (
    <div className={`mt-3 text-xs ${dark ? 'text-gray-300' : 'text-charcoal-500'}`}>
      <div className="flex items-center gap-x-5 gap-y-1 flex-wrap">
        {biz.licenceVerified && (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle size={12} className={icon} /> Registration checked
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={12} className={icon} /> {biz.location}
          {biz.country === 'UK' && <span className={icon}>(services only)</span>}
        </span>
        {biz.googleRating && (
          <span className="inline-flex items-center gap-1.5">
            <GoogleGMark className="w-3 h-3" /> {biz.googleRating.toFixed(1)}
            <span className={icon}>({biz.googleReviewCount})</span>
          </span>
        )}
      </div>
      {biz.memberSince && formatMemberSince(biz.memberSince) && (
        <p className="mt-1">BILD member since {formatMemberSince(biz.memberSince)}</p>
      )}
    </div>
  )
}

// A featured listing is a paid placement, so it has to look like one from a
// glance down the page rather than only on close reading. It is the one dark
// object on a cream page: nothing else in the directory can be mistaken for it,
// and the standard rows below cannot drift towards looking the same.
//
// The white logo tile is deliberate. A logo drawn for a light background - most
// of them - would disappear straight into a charcoal panel, so the tile keeps
// its own white ground and reads as a framed object rather than a hole.
function FeaturedRow({ biz }: { biz: DisplayBusiness }) {
  const href = biz.slug ? `/directory/${biz.slug}` : '#'
  const offer = splitOffer(biz.bildOffer)
  return (
    <article className="group relative bg-charcoal-800 border-l-4 border-l-gold-500 shadow-card cursor-pointer transition-colors hover:bg-charcoal-700 focus-within:bg-charcoal-700">
      <div className="grid grid-cols-1 sm:grid-cols-[112px_1fr] xl:grid-cols-[112px_1fr_286px] gap-x-7 gap-y-5 p-6">
        <BusinessAvatar name={biz.name} logoUrl={biz.logoUrl} size="tile" />

        <div className="min-w-0">
          {/* charcoal-900 on gold, not white: white on gold-500 is about 3.2:1
              and fails at this size. */}
          <p className="inline-flex items-center gap-1.5 bg-gold-500 text-charcoal-900 text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 mb-3">
            <Crown size={11} className="fill-charcoal-900 text-charcoal-900" /> Featured
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-400 mb-1">{biz.category}</p>
          <h3 className="font-display text-[28px] leading-tight font-bold text-white">
            {/* Stretched link - see ListingRow for why the `after` overlay and
                the z-10 on the outbound links. */}
            <Link
              href={href}
              className="after:content-[''] after:absolute after:inset-0 underline underline-offset-4 decoration-1 decoration-gold-500/50 group-hover:text-gold-400 group-hover:decoration-gold-400 transition-colors outline-none"
            >
              {biz.name}
            </Link>
          </h3>
          {biz.ownerName && <p className="text-sm text-gray-400 mt-0.5">{biz.ownerName}</p>}
          {(biz.tagline || biz.description) && (
            <p className="text-sm text-gray-300 leading-relaxed mt-2.5 max-w-sm line-clamp-2">
              {biz.tagline || biz.description}
            </p>
          )}
          <MetaLine biz={biz} dark />
        </div>

        <div className="sm:col-start-2 xl:col-start-3">
          {offer && (
            <div className="bg-white/[0.06] border border-gold-500/30 p-5 mb-4">
              <OfferLabel dark />
              {/* "50%" and "Complimentary" cannot share a type size: at 42px
                  the word ran straight out of the panel. Sized by length so a
                  short amount still lands hard and a word still fits. */}
              {offer.lead && (
                <p
                  className={`font-display leading-[1.05] font-bold text-gold-400 break-words ${
                    offer.lead.length <= 5 ? 'text-[42px]' : offer.lead.length <= 9 ? 'text-[30px]' : 'text-[26px]'
                  }`}
                >
                  {offer.lead}
                </p>
              )}
              <p className="text-[15px] text-gray-300 leading-snug mt-1.5">{offer.rest}</p>
            </div>
          )}
          <p className={`${btnPrimary} w-full py-2.5 text-sm justify-center`}>
            View profile
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </p>
          <OutboundLinks biz={biz} className="mt-3" dark />
        </div>
      </div>
    </article>
  )
}

// Everything else, as a ruled row on white. Cards in a grid forced one height
// onto wildly different amounts of text; ruled columns let the eye run straight
// down location, offer or action without reading the rows it skips.
function ListingRow({ biz }: { biz: DisplayBusiness }) {
  const href = biz.slug ? `/directory/${biz.slug}` : '#'
  const offer = splitOffer(biz.bildOffer)
  const rule = 'lg:border-l lg:border-gold-200/60 lg:pl-5'
  return (
    <article className="group relative bg-white border border-gold-200/60 flex gap-4 p-3 items-stretch cursor-pointer transition-all hover:border-gold-400 hover:shadow-card focus-within:border-gold-500">
      <BusinessAvatar name={biz.name} logoUrl={biz.logoUrl} size="tileSm" />

      <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-[1fr_180px_200px_150px] gap-x-5 gap-y-3 items-start">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal-400 mb-0.5">{biz.category}</p>
          <h3 className="font-display text-[17px] leading-tight font-bold text-charcoal-800">
            {/* The stretched link. `after` covers the whole card, so anywhere on
                the row opens the profile, while the accessible name of the link
                is still the business name rather than "this card". Anything that
                must stay separately clickable - the WhatsApp and Website links -
                is lifted above it with relative z-10. */}
            <Link
              href={href}
              className="after:content-[''] after:absolute after:inset-0 underline underline-offset-4 decoration-1 decoration-gold-300 group-hover:text-gold-700 group-hover:decoration-gold-600 transition-colors outline-none"
            >
              {biz.name}
            </Link>
          </h3>
          {biz.ownerName && <p className="text-xs text-charcoal-500">{biz.ownerName}</p>}
          {(biz.tagline || biz.description) && (
            <p className="text-xs text-charcoal-600 leading-relaxed mt-1 line-clamp-2">{biz.tagline || biz.description}</p>
          )}
        </div>

        <div className={`text-xs text-charcoal-500 space-y-1 min-w-0 ${rule}`}>
          <p className="flex items-start gap-1.5">
            <MapPin size={12} className="text-charcoal-400 mt-0.5 shrink-0" />
            <span>
              {biz.location}
              {biz.country === 'UK' && <span className="text-charcoal-400"> (services only)</span>}
            </span>
          </p>
          {biz.memberSince && formatMemberSince(biz.memberSince) && (
            <p>BILD member since {formatMemberSince(biz.memberSince)}</p>
          )}
          {biz.licenceVerified && (
            <p className="flex items-start gap-1.5">
              <CheckCircle size={12} className="text-charcoal-400 mt-0.5 shrink-0" /> Registration checked
            </p>
          )}
          {biz.googleRating && (
            <p className="flex items-center gap-1.5">
              <GoogleGMark className="w-3 h-3 shrink-0" /> {biz.googleRating.toFixed(1)}
              <span className="text-charcoal-400">({biz.googleReviewCount})</span>
            </p>
          )}
        </div>

        <div className={`min-w-0 ${rule}`}>
          {offer && (
            <>
              <OfferLabel />
              <p className="text-[15px] leading-snug text-charcoal-700">
                {offer.lead && <span className="font-display font-bold text-charcoal-800">{offer.lead} </span>}
                {offer.rest}
              </p>
            </>
          )}
        </div>

        <div className={`min-w-0 space-y-2 ${rule}`}>
          <p className={`${linkUnderline} text-[13px] font-medium text-gold-700`}>
            View profile
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </p>
          <OutboundLinks biz={biz} stack />
        </div>
      </div>
    </article>
  )
}

export default function DirectoryClient({
  businesses,
  googleBadge,
}: {
  businesses: DisplayBusiness[]
  googleBadge?: React.ReactNode
}) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [offersOnly, setOffersOnly] = useState(false)
  const [allCategories, setAllCategories] = useState(false)
  const debouncedSearch = useDebounce(search, 300)
  const resultsRef = useRef<HTMLDivElement>(null)

  const offerCount = useMemo(() => businesses.filter(b => b.bildOffer?.trim()).length, [businesses])

  // Sorted by how many listings each holds, so the categories people actually
  // browse sit at the top rather than whatever happens to start with A.
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    businesses.forEach(b => counts.set(b.category, (counts.get(b.category) || 0) + 1))
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
  }, [businesses])

  // The selected category always stays on screen, even when it lives in the
  // hidden tail - otherwise clicking through from search leaves the sidebar
  // showing nothing selected.
  const shownCategories = useMemo(() => {
    if (allCategories) return categories
    const head = categories.slice(0, CATEGORIES_SHOWN)
    if (activeCategory !== 'All' && !head.some(c => c.name === activeCategory)) {
      const active = categories.find(c => c.name === activeCategory)
      if (active) return [...head, active]
    }
    return head
  }, [categories, allCategories, activeCategory])

  const featured = useMemo(() => businesses.filter(b => b.featured), [businesses])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    return businesses
      .filter(b => {
        const matchesSearch =
          !q ||
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.ownerName.toLowerCase().includes(q) ||
          b.location.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          (b.tagline || '').toLowerCase().includes(q) ||
          (b.bildOffer || '').toLowerCase().includes(q)
        const matchesCategory = activeCategory === 'All' || b.category === activeCategory
        const matchesOffer = !offersOnly || !!b.bildOffer?.trim()
        return matchesSearch && matchesCategory && matchesOffer
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [businesses, debouncedSearch, activeCategory, offersOnly])

  // Only the first page is put in the DOM. Every listing stays in memory, so
  // search and filtering are instant, but the initial page does not grow as the
  // directory does.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [debouncedSearch, activeCategory, offersOnly])

  const visible = filtered.slice(0, visibleCount)
  const remaining = filtered.length - visible.length
  const isFiltering = activeCategory !== 'All' || debouncedSearch.trim() !== '' || offersOnly

  function clearFilters() {
    setSearch('')
    setActiveCategory('All')
    setOffersOnly(false)
  }

  const catButton = (name: string, label: string, count: number) => (
    <li key={name}>
      <button
        onClick={() => setActiveCategory(name)}
        className={`w-full flex items-start justify-between gap-2 text-left text-sm px-3 py-1.5 transition-colors ${
          activeCategory === name
            ? 'bg-white border-l-2 border-gold-500 text-charcoal-800 font-semibold'
            : 'text-charcoal-600 hover:bg-white/70 border-l-2 border-transparent'
        }`}
      >
        <span className="leading-snug">{label}</span>
        <span className="text-charcoal-400 text-xs shrink-0 pt-0.5">{count}</span>
      </button>
    </li>
  )

  return (
    <div className="bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">

        {/* ---------------- hero ---------------- */}
        <div className="flex items-start justify-between gap-10">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600 mb-3">The BILD Business Directory</p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-charcoal-800 leading-[1.05] mb-4 text-balance">
              Good people. Great businesses.
            </h1>
            <p className="text-charcoal-600 text-lg leading-relaxed">
              Discover the expertise within our community, and a little extra for BILD members.
            </p>
          </div>
          <div className="hidden lg:block text-right shrink-0 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal-500 leading-[1.7]">
              British Indians<br />Living in Dubai
            </p>
            <div className="w-8 h-px bg-gold-300 ml-auto my-3" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal-400 leading-[1.7]">
              A stronger<br />community together
            </p>
          </div>
        </div>

        {/* ---------------- search ---------------- */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search businesses, people, services or offers..."
              aria-label="Search the business directory"
              className="w-full bg-white border border-gold-200 pl-11 pr-10 py-4 text-charcoal-800 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700">
                <X size={16} />
              </button>
            )}
          </div>
          {/* Filtering is live as you type, so this has nothing to submit. It is
              here because a search box without a button reads as unfinished, and
              anyone who does press it is taken to the results rather than
              nothing happening at all. */}
          <button
            onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`${btnPrimary} sm:w-48 py-4 justify-center rounded-none`}
          >
            Search
          </button>
        </div>
        <div className="flex justify-end mt-2.5">
          <Link href="/directory/submit" className={`${linkUnderline} text-sm font-medium text-gold-700`}>
            List your business <ArrowRight size={14} />
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap mt-7">
          <div>{googleBadge}</div>
          <p className="text-xs text-charcoal-500">
            {businesses.length} business{businesses.length === 1 ? '' : 'es'}
            <span className="mx-3 text-gold-300">|</span>
            {offerCount} with member offers
          </p>
        </div>

        {/* ---------------- sidebar + listings ---------------- */}

        {/* The phone equivalent of the sidebar: eighteen categories and the
            trust note pushed the first business about three screens down. */}
        <div className="lg:hidden mt-5 flex flex-col gap-3">
          <label className="sr-only" htmlFor="directory-category">Category</label>
          <select
            id="directory-category"
            value={activeCategory}
            onChange={e => setActiveCategory(e.target.value)}
            className="w-full bg-white border border-gold-200 px-4 py-3 text-sm text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-500"
          >
            <option value="All">All categories ({businesses.length})</option>
            {categories.map(c => (
              <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2.5 text-sm text-charcoal-600">
            <input
              type="checkbox"
              checked={offersOnly}
              onChange={e => setOffersOnly(e.target.checked)}
              className="h-4 w-4 accent-gold-500"
            />
            With a member offer only <span className="text-charcoal-400 text-xs">({offerCount})</span>
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[228px_1fr] gap-x-9 mt-4">

          <aside className="hidden lg:block lg:sticky lg:top-28 lg:self-start lg:border-r lg:border-gold-200/70 lg:pr-5 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-600 mb-3">Browse by category</p>
            <ul className="space-y-0.5">
              {catButton('All', 'All businesses', businesses.length)}
              {shownCategories.map(c => catButton(c.name, c.name, c.count))}
            </ul>
            {categories.length > CATEGORIES_SHOWN && (
              <button
                onClick={() => setAllCategories(v => !v)}
                className="mt-2 ml-3 text-xs font-medium text-gold-700 underline underline-offset-4 decoration-gold-300 hover:decoration-gold-600"
              >
                {allCategories ? 'Show fewer' : `Show all ${categories.length} categories`}
              </button>
            )}

            <div className="border-t border-gold-200 mt-5 pt-4">
              <label className="flex items-center justify-between gap-3 text-sm text-charcoal-600 cursor-pointer px-3">
                <span className="inline-flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={offersOnly}
                    onChange={e => setOffersOnly(e.target.checked)}
                    className="h-4 w-4 accent-gold-500"
                  />
                  With a member offer only
                </span>
                <span className="text-charcoal-400 text-xs">{offerCount}</span>
              </label>
            </div>

            <TrustBlurb />
          </aside>

          <main className="min-w-0">
            {/* Featured is hidden while filtering, so a search returns one
                honest list rather than promoted rows above the answer. */}
            {!isFiltering && featured.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-1.5">
                  <Crown size={15} className="fill-gold-500 text-gold-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-600">Featured placements</span>
                  <span className="flex-1 h-px bg-gold-200" />
                </div>
                <h2 className="font-display text-[32px] font-bold text-charcoal-800 leading-tight">Featured in our community</h2>
                <p className="text-charcoal-500 text-sm mt-1 mb-5">A closer introduction to our featured community businesses.</p>
                <div className="space-y-4">{featured.map(b => <FeaturedRow key={b.id} biz={b} />)}</div>
              </section>
            )}

            <section ref={resultsRef}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 sm:gap-4 border-t border-gold-200 pt-7 mb-4">
                <h2 className="font-display text-[32px] font-bold text-charcoal-800 leading-tight">
                  {isFiltering ? 'Results' : 'All businesses'}
                  <span className="text-charcoal-400 font-normal"> &middot; {filtered.length}</span>
                </h2>
                {remaining > 0 && (
                  <p className="text-xs text-charcoal-500 shrink-0 sm:pb-1.5">Showing {remaining} more businesses</p>
                )}
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-charcoal-700 font-medium mb-1">No businesses match that.</p>
                  <p className="text-charcoal-500 text-sm mb-4">Try a different word, or clear the filters.</p>
                  <button onClick={clearFilters} className="text-gold-700 text-sm font-medium underline underline-offset-4">
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">{visible.map(b => <ListingRow key={b.id} biz={b} />)}</div>
                  {remaining > 0 && (
                    <div className="text-center mt-8">
                      <button
                        onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                        className="inline-flex items-center gap-2 bg-white border border-gold-300 hover:border-gold-500 text-charcoal-700 px-6 py-3 text-sm font-semibold transition-colors"
                      >
                        Show {Math.min(remaining, PAGE_SIZE)} more
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            <div className="lg:hidden mt-10"><TrustBlurb /></div>
          </main>
        </div>

        {/* ---------------- get listed (content unchanged) ---------------- */}
        <div className="mt-16 bg-gold-50 border border-gold-200 px-4 py-3 text-center text-sm text-charcoal-700">
          <strong className="text-charcoal-800">Free for BILD members.</strong> Listings are free for BILD members until {LISTING_GRACE_LABEL}.
        </div>

        <div className="mt-5 bg-charcoal-800 p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-6 text-center lg:text-left">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-white mb-1">Own a business? Get listed</h2>
            <p className="text-gray-300 text-sm">
              Open to BILD members and non-BILD businesses alike. Add your business in minutes and reach 2,000+ British Indians across the UAE.
            </p>
            <p className="text-gold-400 text-sm font-medium mt-2">
              Submitting is free - a listing fee applies once approved (member rates available).
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Listings are open to businesses holding a valid UAE trade licence, or UK-registered businesses. You will
              be asked to provide your registration details when you submit.
            </p>
            <p className="text-gray-400 text-xs mt-1 italic">
              UK-registered businesses may only transact for services delivered in the UK, not for services provided within the UAE.
            </p>
          </div>
          <Link href="/directory/submit" className={`${btnPrimary} shrink-0 px-7 py-3.5`}>
            Submit Your Business
          </Link>
        </div>

        <div className="text-center mt-8">
          <Link href="/directory/get-featured" className={`${linkUnderline} text-sm font-medium text-gold-600`}>
            <Star size={14} className="fill-gold-500 text-gold-500" /> Own a listing? Get Featured
          </Link>
        </div>
      </div>
    </div>
  )
}

function TrustBlurb() {
  return (
    <div className="border-t border-gold-200 mt-5 pt-5 px-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-600 leading-relaxed mb-2">
        A community of<br />trusted professionals
      </p>
      <p className="text-xs text-charcoal-500 leading-relaxed mb-3">
        All businesses are BILD members and have been through our membership verification process. BILD
        provides this directory as a platform to connect, and does not endorse or guarantee any business listed.
      </p>
      <Link href="/directory/submit" className={`${linkUnderline} text-xs font-medium text-gold-700`}>
        Find out more <ArrowRight size={12} />
      </Link>
    </div>
  )
}
