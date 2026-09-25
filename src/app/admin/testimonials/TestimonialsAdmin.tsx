'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/admin/AdminNav'
import { Testimonial } from '@/lib/testimonials'
import { Star, Check, X, Trash2, Loader2, Store, ExternalLink, Lock } from 'lucide-react'

type Tab = 'pending' | 'approved' | 'rejected'
type Scope = 'all' | 'bild' | 'business'
type BusinessNames = Record<string, { name: string; slug: string | null }>

function TestimonialCard({ t, business }: { t: Testimonial; business?: { name: string; slug: string | null } }) {
  const router = useRouter()
  const [processing, setProcessing] = useState(false)

  async function setStatus(status: 'approved' | 'rejected') {
    setProcessing(true)
    const res = await fetch('/api/admin/testimonials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, status }),
    })
    if (res.ok) router.refresh()
    else { alert('Could not update. Please try again.'); setProcessing(false) }
  }

  async function remove() {
    if (!confirm(`Delete this testimonial from ${t.name}?`)) return
    setProcessing(true)
    const res = await fetch('/api/admin/testimonials', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id }),
    })
    if (res.ok) router.refresh()
    else { alert('Could not delete. Please try again.'); setProcessing(false) }
  }

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white font-semibold text-sm">{t.name}</p>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={13} className={i < t.rating ? 'fill-gold-400 text-gold-400' : 'text-gray-600'} />
          ))}
        </div>
      </div>
      {/* Makes it obvious at a glance whether this is about BILD itself or
          about one of the directory businesses. */}
      {t.business_id ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400 mb-2">
          <Store size={11} />
          {business?.slug ? (
            <a href={`/directory/${business.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
              Review of {business.name} <ExternalLink size={10} />
            </a>
          ) : (
            `Review of ${business?.name || 'a business'}`
          )}
        </p>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-charcoal-700 text-gray-400 mb-2">
          About BILD
        </p>
      )}
      {t.headline && <p className="text-gold-400 text-xs mb-2">{t.headline}</p>}
      <p className="text-gray-300 text-sm leading-relaxed mb-3">&ldquo;{t.quote}&rdquo;</p>
      {/* Admin-only: lets you sanity-check the reviewer is a real person before
          approving. Never shown publicly, never sent to the business. */}
      {(t.reviewer_email || t.reviewer_phone) && (
        <div className="bg-charcoal-900/60 border border-charcoal-700 rounded-lg px-3 py-2 mb-3">
          <p className="flex items-center gap-1.5 text-gray-500 text-[11px] uppercase tracking-wide mb-1">
            <Lock size={10} /> Reviewer contact (admin only)
          </p>
          {t.reviewer_email && (
            <p className="text-gray-300 text-xs break-all">
              <a href={`mailto:${t.reviewer_email}`} className="hover:text-gold-400">{t.reviewer_email}</a>
            </p>
          )}
          {t.reviewer_phone && (
            <p className="text-gray-300 text-xs">
              <a href={`tel:${t.reviewer_phone}`} className="hover:text-gold-400">{t.reviewer_phone}</a>
            </p>
          )}
        </div>
      )}
      <p className="text-gray-500 text-xs mb-4">Submitted {new Date(t.created_at).toLocaleDateString('en-GB')}</p>
      <div className="flex gap-2">
        {t.status !== 'approved' && (
          <button onClick={() => setStatus('approved')} disabled={processing}
            className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
            {processing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
          </button>
        )}
        {t.status !== 'rejected' && (
          <button onClick={() => setStatus('rejected')} disabled={processing}
            className="inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
            <X size={13} /> Reject
          </button>
        )}
        <button onClick={remove} disabled={processing}
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ml-auto disabled:opacity-50">
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  )
}

export default function TestimonialsAdmin({ testimonials, businessNames = {} }: { testimonials: Testimonial[]; businessNames?: BusinessNames }) {
  const [tab, setTab] = useState<Tab>('pending')
  const [scope, setScope] = useState<Scope>('all')

  const inScope = testimonials.filter(t =>
    scope === 'all' ? true : scope === 'business' ? !!t.business_id : !t.business_id
  )
  const byTab = inScope.filter(t => t.status === tab)
  const counts: Record<Tab, number> = {
    pending: inScope.filter(t => t.status === 'pending').length,
    approved: inScope.filter(t => t.status === 'approved').length,
    rejected: inScope.filter(t => t.status === 'rejected').length,
  }
  const scopeCounts: Record<Scope, number> = {
    all: testimonials.length,
    bild: testimonials.filter(t => !t.business_id).length,
    business: testimonials.filter(t => !!t.business_id).length,
  }
  const scopeLabels: Record<Scope, string> = { all: 'All', bild: 'About BILD', business: 'Business reviews' }

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="BILD Testimonials" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">BILD Testimonials</h1>
        <p className="text-gray-400 text-sm">
          Member-submitted reviews awaiting approval. Testimonials about BILD appear on the homepage alongside Google
          reviews; reviews of a directory business appear on that business&rsquo;s own profile page.
        </p>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'bild', 'business'] as Scope[]).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                scope === s ? 'bg-charcoal-600 text-white' : 'bg-charcoal-800 text-gray-500 hover:text-white border border-charcoal-700'
              }`}
            >
              {scopeLabels[s]} ({scopeCounts[s]})
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                tab === t ? 'bg-gold-500 text-white' : 'bg-charcoal-800 text-gray-400 hover:text-white border border-charcoal-700'
              }`}
            >
              {t} ({counts[t]})
            </button>
          ))}
        </div>

        {byTab.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No {tab} testimonials.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {byTab.map(t => (
              <TestimonialCard key={t.id} t={t} business={t.business_id ? businessNames[t.business_id] : undefined} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
