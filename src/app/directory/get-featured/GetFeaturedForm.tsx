'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { btnPrimary } from '@/lib/ui'

export default function GetFeaturedForm() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      const res = await fetch('/api/business/get-featured-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      setMessage(json.message || "If we found a listing under that email, we've sent the link.")
    } catch {
      setMessage('Something went wrong. Please try again or email connect@bild.ae.')
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={submit} className="max-w-md mx-auto">
      <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Your listing&apos;s email address</label>
      <input
        type="email" required value={email} onChange={e => setEmail(e.target.value)}
        placeholder="you@yourbusiness.com"
        className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400 mb-4"
      />
      <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-3`}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null} {submitting ? 'Sending...' : 'Send me my link'}
      </button>
      {message && <p className="text-sm text-charcoal-600 mt-4 text-center">{message}</p>}
    </form>
  )
}
