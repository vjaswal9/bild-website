'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2, Star } from 'lucide-react'
import { btnPrimary } from '@/lib/ui'

export default function GoogleReviewsForm({ token, businessName }: { token: string; businessName: string }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ rating: number | null; totalReviews: number | null; profileUrl: string } | null>(null)

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!url.trim()) return setError('Please paste your link first.')
    setBusy(true)
    try {
      const res = await fetch('/api/business/google-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, url }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || 'Could not connect your link. Please try again.')
      else setDone(d)
    } catch {
      setError('Could not connect. Please check your connection and try again.')
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="bg-white border border-green-200 rounded-2xl p-6 text-center">
        <CheckCircle2 size={36} className="text-green-600 mx-auto mb-3" />
        {done.rating != null ? (
          <>
            <p className="font-display text-xl font-bold text-charcoal-800 mb-1">Found your reviews</p>
            <p className="flex items-center justify-center gap-1.5 text-charcoal-700 mb-3">
              <Star size={16} className="fill-gold-500 text-gold-500" />
              <strong>{done.rating.toFixed(1)} stars</strong> from {done.totalReviews} Google reviews
            </p>
            <p className="text-sm text-charcoal-600 mb-5">They are now showing on the {businessName} listing.</p>
          </>
        ) : (
          <>
            <p className="font-display text-xl font-bold text-charcoal-800 mb-1">Connected</p>
            <p className="text-sm text-charcoal-600 mb-5">
              We found your Google business, but it has no reviews yet. Your rating will appear on your listing as soon as you get your first one.
            </p>
          </>
        )}
        <Link href={done.profileUrl} className={`${btnPrimary} px-6 py-3`}>View your listing</Link>
      </div>
    )
  }

  return (
    <form onSubmit={connect} className="bg-white border border-gold-200 rounded-2xl p-6 space-y-3">
      <label htmlFor="google-link" className="block text-sm font-semibold text-charcoal-700">Your Google review link</label>
      <input
        id="google-link"
        type="text"
        inputMode="url"
        autoComplete="off"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="g.page/r/.../review"
        className="w-full px-4 py-3 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400"
      />
      {error && <p className="text-ruby-500 text-sm">{error}</p>}
      <button type="submit" disabled={busy} className={`${btnPrimary} px-6 py-3`}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        {busy ? 'Checking your link...' : 'Connect'}
      </button>
    </form>
  )
}
