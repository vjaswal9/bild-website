'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, CheckCircle, ArrowLeft } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import { btnPrimary } from '@/lib/ui'

const inputBase = 'w-full px-4 py-2.5 border rounded-xl bg-white text-charcoal-800 border-gold-200 focus:outline-none focus:ring-2 focus:ring-gold-400 transition-colors'

export default function SubmitTestimonialPage() {
  const [name, setName] = useState('')
  const [headline, setHeadline] = useState('')
  const [quote, setQuote] = useState('')
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !quote.trim()) { setError('Please fill in your name and your review.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/testimonials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, headline, quote, rating }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) setDone(true)
      else { setError(json.error || 'Could not submit. Please try again.'); setSubmitting(false) }
    } catch {
      setError('Could not submit. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <>
        <PageHero title="Thank you!" subtitle="Your review has been submitted" />
        <div className="py-16 max-w-lg mx-auto px-4 sm:px-6 text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <p className="text-charcoal-600">
            Thanks for sharing your experience with BILD. We&rsquo;ll review it shortly - approved reviews appear on our homepage.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 text-gold-600 hover:underline mt-6 text-sm font-medium">
            <ArrowLeft size={15} /> Back to homepage
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHero title="Share your experience" subtitle="Tell the community what BILD means to you" />
      <div className="py-12 max-w-lg mx-auto px-4 sm:px-6">
        <form onSubmit={submit} className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5 shadow-card">
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className={inputBase} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Headline <span className="text-charcoal-400 font-normal">(optional, e.g. &ldquo;BILD member since 2022&rdquo;)</span></label>
            <input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="A short line about you" className={inputBase} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Your rating</label>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const n = i + 1
                const filled = n <= (hoverRating || rating)
                return (
                  <button
                    key={n} type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  >
                    <Star size={28} className={filled ? 'fill-gold-500 text-gold-500' : 'text-gold-200'} />
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Your review</label>
            <textarea
              value={quote} onChange={e => setQuote(e.target.value.slice(0, 1000))}
              rows={5} placeholder="What has your experience with BILD been like?"
              className={`${inputBase} resize-none`}
            />
            <p className="text-xs text-charcoal-400 mt-1 text-right">{quote.length}/1000</p>
          </div>
          {error && <p className="text-sm text-ruby-500 bg-ruby-500/10 border border-ruby-500/20 rounded-xl p-3">{error}</p>}
          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-3`}>
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
          <p className="text-xs text-charcoal-400 text-center">
            Reviews are checked by an admin before appearing on the site.
          </p>
        </form>
      </div>
    </>
  )
}
