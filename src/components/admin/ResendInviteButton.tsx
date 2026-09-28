'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'

// Sits on a paid member's profile, next to the invite history it re-writes.
// Generates a brand new single-use WhatsApp link and emails it - the fix for
// a gap that existed the whole time this feature has been live: the expired-
// invite page promises "we will send you a fresh invite the same day", and
// until now nothing on the admin side could actually do that.
export default function ResendInviteButton({ memberId }: { memberId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function reissue() {
    if (!confirm('Send a fresh WhatsApp invite to this member? Their previous link stops working once this one is created.')) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/members/reissue-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId }),
      })
      const d = await res.json()
      if (res.ok) {
        setSent(true)
        router.refresh()
      } else {
        setError(d.error || 'Could not reissue the invite.')
      }
    } catch {
      setError('Network error.')
    }
    setBusy(false)
  }

  return (
    <div className="mt-3">
      <button
        onClick={reissue}
        disabled={busy}
        className="inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {busy ? 'Sending...' : 'Resend WhatsApp invite'}
      </button>
      {sent && (
        <p className="text-green-400 text-xs mt-2 flex items-center gap-1.5">
          <CheckCircle2 size={13} /> A fresh invite was emailed. The rows above now reflect the new link.
        </p>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}
