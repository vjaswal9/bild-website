'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, ShieldCheck } from 'lucide-react'

// The password prompt shown instead of the dashboard. Nothing financial is
// rendered behind it: the page does not query a single figure until the
// unlock cookie is valid, so the numbers are never in the page source.
export default function MoneyLock() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function unlock() {
    if (!password) return setError('Please enter the admin password.')
    setError('')
    setBusy(true)
    const res = await fetch('/api/admin/money/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.refresh()
      return
    }
    const d = await res.json().catch(() => ({}))
    setError(d.error || 'Could not unlock.')
    setBusy(false)
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-7 text-center">
        <span className="w-14 h-14 rounded-2xl bg-gold-500/15 flex items-center justify-center mx-auto mb-5">
          <Lock size={24} className="text-gold-400" />
        </span>
        <h1 className="font-display text-2xl font-bold text-white">Money is locked</h1>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
          This section shows BILD&rsquo;s revenue, costs and profit. Enter the admin password to unlock it for 30
          minutes.
        </p>

        <input
          type="password"
          value={password}
          autoFocus
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !busy) unlock() }}
          placeholder="Admin password"
          className="w-full bg-charcoal-900 border border-charcoal-600 rounded-xl px-4 py-3 text-sm text-white text-center mt-6 focus:outline-none focus:border-gold-500"
        />

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <button
          onClick={unlock}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-3 rounded-xl text-sm font-semibold mt-4 transition-colors"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          {busy ? 'Unlocking...' : 'Unlock Money'}
        </button>
      </div>
    </div>
  )
}
