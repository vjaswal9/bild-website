'use client'

import { useMemo, useState } from 'react'
import {
  Search, X, ExternalLink, MapPin, BadgeCheck, Info,
  Car, Wrench, Stethoscope, UtensilsCrossed, Scale, Briefcase, Dumbbell, Plane, LayoutGrid,
} from 'lucide-react'
import Reveal from '@/components/anim/Reveal'

type Category = { id: string; name: string }
type Entry = {
  name: string
  category: string
  description: string
  url?: string
  area?: string
  member?: boolean
}

const CATEGORY_ICON: Record<string, React.ElementType> = {
  car: Car,
  home: Wrench,
  health: Stethoscope,
  food: UtensilsCrossed,
  money: Scale,
  professional: Briefcase,
  fitness: Dumbbell,
  travel: Plane,
}

function hostFromUrl(url?: string) {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Visit'
  }
}

export default function KnowledgeBaseClient({
  categories, entries,
}: {
  categories: Category[]; entries: Entry[]
}) {
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<string>('all')

  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (active !== 'all' && e.category !== active) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.area || '').toLowerCase().includes(q) ||
        (categories.find(c => c.id === e.category)?.name.toLowerCase().includes(q) ?? false)
      )
    })
  }, [entries, categories, active, q])

  // Group filtered entries by category, preserving category order.
  const grouped = categories
    .map(c => ({ cat: c, items: filtered.filter(e => e.category === c.id) }))
    .filter(g => g.items.length > 0)

  const countFor = (id: string) => entries.filter(e => e.category === id).length

  return (
    <div className="py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Intro / disclaimer */}
        <div className="flex items-start gap-3 bg-gold-50 border border-gold-100 rounded-xl p-4 mb-8 text-sm text-charcoal-600">
          <Info size={18} className="text-gold-500 shrink-0 mt-0.5" />
          <p>
            These are suggestions shared by BILD members over time, gathered here to save you scrolling.
            They are member opinions, not formal endorsements, so please do your own checks. For contacts marked
            &ldquo;ask in the group&rdquo;, drop a message in your BILD WhatsApp group.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recommendations, e.g. plumber, dentist, fish and chips..."
            className="w-full pl-11 pr-10 py-3 bg-white border border-charcoal-200 rounded-xl text-charcoal-800 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2 mb-10">
          <Chip label="All" icon={LayoutGrid} active={active === 'all'} onClick={() => setActive('all')} count={entries.length} />
          {categories.map(c => (
            <Chip
              key={c.id}
              label={c.name}
              icon={CATEGORY_ICON[c.id] || LayoutGrid}
              active={active === c.id}
              onClick={() => setActive(c.id)}
              count={countFor(c.id)}
            />
          ))}
        </div>

        {/* Results */}
        {grouped.length === 0 ? (
          <p className="text-center text-charcoal-500 py-16">
            No recommendations match &ldquo;{search}&rdquo;. Try a different term.
          </p>
        ) : (
          <div className="space-y-12">
            {grouped.map(({ cat, items }) => {
              const Icon = CATEGORY_ICON[cat.id] || LayoutGrid
              return (
                <section key={cat.id}>
                  <div className="flex items-center gap-2 mb-5">
                    <Icon size={20} className="text-gold-500" />
                    <h2 className="font-display text-2xl font-bold text-charcoal-800">{cat.name}</h2>
                    <span className="text-charcoal-400 text-sm">({items.length})</span>
                  </div>
                  <Reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" stagger={0.07} y={30}>
                    {items.map((e, i) => (
                      <EntryCard key={`${e.name}-${i}`} entry={e} />
                    ))}
                  </Reveal>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({
  label, icon: Icon, active, onClick, count,
}: {
  label: string; icon: React.ElementType; active: boolean; onClick: () => void; count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
        active
          ? 'bg-charcoal-800 text-white border-charcoal-800'
          : 'bg-white text-charcoal-600 border-charcoal-200 hover:border-charcoal-400'
      }`}
    >
      <Icon size={15} /> {label}
      <span className={active ? 'text-white/60' : 'text-charcoal-400'}>{count}</span>
    </button>
  )
}

function EntryCard({ entry }: { entry: Entry }) {
  return (
    <div className="bg-white rounded-2xl border border-charcoal-100 shadow-[0_4px_16px_rgba(20,20,20,0.04)] p-5 flex flex-col hover:shadow-[0_8px_28px_rgba(20,20,20,0.08)] transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-display text-lg font-bold text-charcoal-800 leading-snug">{entry.name}</h3>
        {entry.member && (
          <span className="shrink-0 inline-flex items-center gap-1 bg-gold-500/15 text-gold-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
            <BadgeCheck size={12} /> BILD member
          </span>
        )}
      </div>
      {entry.area && (
        <p className="flex items-center gap-1 text-charcoal-400 text-xs mb-2">
          <MapPin size={12} /> {entry.area}
        </p>
      )}
      <p className="text-charcoal-600 text-sm leading-relaxed flex-1">{entry.description}</p>
      {entry.url && (
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-gold-600 hover:text-gold-700 text-sm font-semibold"
        >
          {hostFromUrl(entry.url)} <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}
