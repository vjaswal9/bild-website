'use client'

import { useState } from 'react'
import Image from 'next/image'
import { BusinessSubmission } from '@/lib/supabase'
import { CheckCircle, XCircle, Clock, ExternalLink, LogOut, RefreshCw, FileText, Star, Search, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Tab = 'pending' | 'approved' | 'rejected' | 'featured'

export default function AdminDashboard({ submissions }: { submissions: BusinessSubmission[] }) {
  const [tab, setTab] = useState<Tab>('pending')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const pending = submissions.filter(s => s.status === 'pending')
  const approved = submissions.filter(s => s.status === 'approved')
  const rejected = submissions.filter(s => s.status === 'rejected')
  const featured = approved.filter(s => s.featured)

  const byTab =
    tab === 'pending' ? pending :
    tab === 'approved' ? approved :
    tab === 'featured' ? featured :
    rejected

  const q = search.trim().toLowerCase()
  const filtered = q
    ? byTab.filter(s =>
        s.business_name.toLowerCase().includes(q) ||
        s.owner_name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      )
    : byTab

  async function handleReview(id: string, action: 'approved' | 'rejected') {
    setProcessing(id)
    const res = await fetch('/api/admin/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, admin_notes: notes[id] || '' }),
    })
    if (res.ok) {
      // Full reload guarantees fresh server data
      window.location.reload()
    } else {
      alert('Something went wrong. Please try again.')
      setProcessing(null)
    }
  }

  async function handleFeature(id: string, featured: boolean) {
    setProcessing(id)
    const res = await fetch('/api/admin/feature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, featured }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      alert('Something went wrong. Please try again.')
      setProcessing(null)
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <div className="min-h-screen bg-charcoal-900">
      {/* Header */}
      <header className="bg-charcoal-800 border-b border-charcoal-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/bild-logo-new.svg" alt="BILD" width={64} height={40} className="h-10 w-auto object-contain brightness-0 invert" />
          <div>
            <h1 className="font-display font-bold text-white text-lg">BILD Admin</h1>
            <p className="text-gray-400 text-xs">Business Directory</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.location.reload()} className="text-gray-400 hover:text-white transition-colors" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Pending Review', count: pending.length, colour: 'text-yellow-400', tab: 'pending' as Tab },
            { label: 'Approved', count: approved.length, colour: 'text-green-400', tab: 'approved' as Tab },
            { label: 'Featured', count: featured.length, colour: 'text-gold-400', tab: 'featured' as Tab },
            { label: 'Rejected', count: rejected.length, colour: 'text-red-400', tab: 'rejected' as Tab },
          ].map(s => (
            <button
              key={s.tab}
              onClick={() => setTab(s.tab)}
              className={`bg-charcoal-800 rounded-xl p-5 text-left border transition-colors ${tab === s.tab ? 'border-gold-500' : 'border-charcoal-700 hover:border-charcoal-600'}`}
            >
              <p className={`text-3xl font-display font-bold ${s.colour}`}>{s.count}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by business, owner, category, location, email..."
            className="w-full pl-11 pr-4 py-2.5 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['pending', 'approved', 'featured', 'rejected'] as Tab[]).map(t => {
            const count = t === 'pending' ? pending.length : t === 'approved' ? approved.length : t === 'featured' ? featured.length : rejected.length
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-gold-500 text-white' : 'bg-charcoal-800 text-gray-400 hover:text-white'}`}
              >
                {t} ({count})
              </button>
            )
          })}
        </div>

        {search && (
          <p className="text-gray-500 text-sm mb-4">
            {filtered.length} result{filtered.length === 1 ? '' : 's'} for &ldquo;{search}&rdquo; in {tab}
          </p>
        )}

        {/* Submissions */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Clock size={40} className="mx-auto mb-4 opacity-40" />
            <p>No {tab} submissions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(sub => (
              <div key={sub.id} className="bg-charcoal-800 rounded-2xl border border-charcoal-700 overflow-hidden">
                {/* Card header */}
                <div className="flex items-start justify-between p-6 border-b border-charcoal-700">
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h2 className="font-display text-xl font-bold text-white">{sub.business_name}</h2>
                      <span className="bg-gold-500/20 text-gold-400 text-xs font-medium px-2.5 py-0.5 rounded-full">{sub.category}</span>
                      {sub.featured && (
                        <span className="inline-flex items-center gap-1 bg-gold-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                          <Star size={11} className="fill-white" /> Featured
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">{sub.owner_name} · {sub.location}</p>
                    <p className="text-gray-500 text-xs mt-1">Submitted {new Date(sub.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Feature toggle — only for approved businesses */}
                    {sub.status === 'approved' && (
                      <button
                        onClick={() => handleFeature(sub.id, !sub.featured)}
                        disabled={processing === sub.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                          sub.featured
                            ? 'bg-gold-500 text-white hover:bg-gold-600'
                            : 'bg-charcoal-700 text-gray-300 hover:bg-charcoal-600'
                        }`}
                        title={sub.featured ? 'Remove from featured' : 'Add to featured'}
                      >
                        <Star size={13} className={sub.featured ? 'fill-white' : ''} />
                        {sub.featured ? 'Featured' : 'Feature'}
                      </button>
                    )}
                    {sub.status === 'approved' && <CheckCircle className="text-green-400" size={24} />}
                    {sub.status === 'rejected' && <XCircle className="text-red-400" size={24} />}
                    {sub.status === 'pending' && <Clock className="text-yellow-400" size={24} />}
                  </div>
                </div>

                {/* Details grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Detail label="Description" value={sub.description} />
                    <Detail label="Email" value={sub.email} />
                    <Detail label="Phone" value={sub.phone} />
                    {sub.website && <Detail label="Website" value={sub.website} link />}
                    {sub.instagram && <Detail label="Instagram" value={`@${sub.instagram}`} />}
                    {sub.tagline && <Detail label="Tagline" value={sub.tagline} />}
                  </div>
                  <div className="space-y-3">
                    {sub.established_year && <Detail label="Established" value={sub.established_year} />}
                    {sub.years_in_business && <Detail label="Years in Business" value={sub.years_in_business} />}
                    {sub.bild_offer && <Detail label="BILD Member Offer" value={sub.bild_offer} highlight />}
                    {sub.extra_info && <Detail label="Extra Info" value={sub.extra_info} />}
                    {sub.logo_url && <Detail label="Logo URL" value={sub.logo_url} link />}
                    {sub.admin_notes && <Detail label="Admin Notes" value={sub.admin_notes} />}
                    {sub.license_url && <LicenseButton path={sub.license_url} />}
                  </div>
                </div>

                {/* Actions only show for pending */}
                {sub.status === 'pending' && (
                  <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
                    <textarea
                      placeholder="Optional notes (visible to admin only)..."
                      value={notes[sub.id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [sub.id]: e.target.value }))}
                      rows={2}
                      className="flex-1 px-4 py-2.5 bg-charcoal-700 border border-charcoal-600 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
                    />
                    <div className="flex gap-2 sm:flex-col">
                      <button
                        onClick={() => handleReview(sub.id, 'approved')}
                        disabled={processing === sub.id}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={16} /> Approve
                      </button>
                      <button
                        onClick={() => handleReview(sub.id, 'rejected')}
                        disabled={processing === sub.id}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LicenseButton({ path }: { path: string }) {
  const [loading, setLoading] = useState(false)

  async function getSignedUrl() {
    setLoading(true)
    const { data } = await supabaseClient.storage
      .from('business-licenses')
      .createSignedUrl(path, 300) // valid for 5 minutes
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
    setLoading(false)
  }

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Business License</p>
      <button
        onClick={getSignedUrl}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        <FileText size={14} /> {loading ? 'Opening...' : 'View License PDF'}
      </button>
    </div>
  )
}

function Detail({ label, value, link, highlight }: { label: string; value: string; link?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="text-gold-400 hover:underline text-sm flex items-center gap-1">
          {value} <ExternalLink size={12} />
        </a>
      ) : (
        <p className={`text-sm ${highlight ? 'text-gold-400 font-medium' : 'text-gray-300'}`}>{value}</p>
      )}
    </div>
  )
}
