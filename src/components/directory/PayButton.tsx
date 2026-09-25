'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { btnPrimary } from '@/lib/ui'

export default function PayButton({ token, checkoutUrl, label }: { token: string; checkoutUrl: string; label: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function pay() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(checkoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json()
      if (res.ok && json.url) {
        window.location.href = json.url
      } else {
        setError(json.error || 'Could not start payment. Please try again or email connect@bild.ae')
        setSubmitting(false)
      }
    } catch {
      setError('Could not start payment. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <button onClick={pay} disabled={submitting} className={`${btnPrimary} px-8 py-3 text-lg w-full sm:w-auto`}>
        <Lock size={16} /> {submitting ? 'Redirecting to payment…' : label}
      </button>
      {error && <p className="text-ruby-500 text-sm mt-3">{error}</p>}
    </div>
  )
}
