'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle, XCircle, Paperclip, Trash2, Clock, ExternalLink } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'

type Row = {
  id: string
  business_id: string
  businessName: string
  businessSlug: string | null
  customer_name: string
  quote: string
  proof_path: string | null
  status: 'pending' | 'approved' | 'declined'
  decline_reason: string | null
  created_at: string
}

type Tab = 'pending' | 'approved' | 'declined'

const TAB_LABEL: Record<Tab, string> = {
  pending: 'Waiting',
  approved: 'Published',
  declined: 'Declined',
}

// Moderation for testimonials businesses have sent in about themselves.
//
// The job here is not "is this nice" but "did a real customer actually say
// this". That is what the proof attachment is for, so viewing it is the
// primary action on a waiting item, not an afterthought.
export default function BusinessTestimonialsAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/business/testimonials')
    const d = await res.json().catch(() => ({}))
    if (res.ok) setRows(d.testimonials || [])
    else setError(d.error || 'Could not load testimonials.')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function viewProof(id: string) {
    setBusyId(id)
    // Opened before the await: a window.open after one is treated as an
    // unrequested popup and blocked.
    const tabRef = window.open('', '_blank')
    try {
      const res = await fetch('/api/admin/business/testimonial-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.url) {
        if (tabRef) tabRef.location.href = d.url
        else window.open(d.url, '_blank')
      } else {
        tabRef?.close()
        alert(d.error || 'Could not open the attachment.')
      }
    } catch {
      tabRef?.close()
      alert('Could not open the attachment.')
    }
    setBusyId(null)
  }

  async function decide(id: string, action: 'approved' | 'declined') {
    const reason = (reasons[id] || '').trim()
    if (action === 'declined' && reason.length < 5) {
      alert('Please give a reason. It is emailed to the business so they know what to fix.')
      return
    }
    setBusyId(id)
    const res = await fetch('/api/admin/business/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, reason }),
    })
    const d = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) return alert(d.error || 'Could not save that.')
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this testimonial permanently? If it is live it comes off the profile page.')) return
    setBusyId(id)
    const res = await fetch('/api/admin/business/testimonials', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setBusyId(null)
    if (res.ok) await load()
    else alert('Could not delete that.')
  }

  const counts: Record<Tab, number> = {
    pending: rows.filter(r => r.status === 'pending').length,
    approved: rows.filter(r => r.status === 'approved').length,
    declined: rows.filter(r => r.status === 'declined').length,
  }
  const visible = rows.filter(r => r.status === tab)

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Business Testimonials" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Business Testimonials</h1>
        <p className="text-gray-400 text-sm mb-6">
          Testimonials businesses have collected from their own customers. Check the attached
          screenshot matches the words before publishing.
        </p>

        <div className="flex gap-2 mb-6 flex-wrap">
          {(['pending', 'approved', 'declined'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t ? 'bg-gold-500 text-white' : 'bg-charcoal-800 text-gray-400 hover:text-white'
              }`}
            >
              {TAB_LABEL[t]} ({counts[t]})
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading</p>
        ) : visible.length === 0 ? (
          <p className="text-gray-500 bg-charcoal-800 border border-charcoal-700 rounded-xl p-8 text-center">
            {tab === 'pending' ? 'Nothing waiting to be checked.' : `No ${TAB_LABEL[tab].toLowerCase()} testimonials.`}
          </p>
        ) : (
          <div className="space-y-4">
            {visible.map(r => (
              <div key={r.id} className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {r.businessSlug ? (
                        <Link href={`/directory/${r.businessSlug}`} target="_blank" className="hover:text-gold-400 inline-flex items-center gap-1.5">
                          {r.businessName} <ExternalLink size={13} />
                        </Link>
                      ) : r.businessName}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1.5">
                      <Clock size={11} /> {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(r.id)}
                    disabled={busyId === r.id}
                    className="p-2 text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                    title="Delete permanently"
                    aria-label="Delete permanently"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <p className="text-gold-400 text-sm font-semibold mt-4">{r.customer_name}</p>
                <p className="text-gray-300 mt-1 italic leading-relaxed">&ldquo;{r.quote}&rdquo;</p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => viewProof(r.id)}
                    disabled={busyId === r.id || !r.proof_path}
                    className="inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
                    title={r.proof_path ? 'Opens for 5 minutes' : 'No attachment'}
                  >
                    {busyId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                    View proof
                  </button>

                  {r.status === 'pending' && (
                    <button
                      onClick={() => decide(r.id, 'approved')}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle size={15} /> Publish
                    </button>
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      id={`reason-${r.id}`}
                      value={reasons[r.id] || ''}
                      onChange={e => setReasons(p => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="Reason for declining - this is emailed to the business"
                      className="flex-1 px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                    <button
                      onClick={() => decide(r.id, 'declined')}
                      disabled={busyId === r.id}
                      className="inline-flex items-center justify-center gap-1.5 bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                    >
                      <XCircle size={15} /> Decline
                    </button>
                  </div>
                )}

                {r.status === 'declined' && r.decline_reason && (
                  <p className="text-sm text-gray-400 mt-3 border-l-2 border-red-700 pl-3">
                    <strong className="text-gray-300">Declined:</strong> {r.decline_reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
