'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function ConfirmPasswordClient() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function confirm() {
    setState('working')
    const res = await fetch('/api/admin/password/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setState('done')
    } else {
      setMessage(data.error || 'Could not confirm the change.')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen bg-charcoal-900 flex items-center justify-center px-4">
      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-8 max-w-md w-full text-center">
        {state === 'done' ? (
          <>
            <CheckCircle size={44} className="text-green-400 mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-white mb-2">Password changed</h1>
            <p className="text-gray-400 text-sm mb-6">Your new admin password is now active. Please sign in with it.</p>
            <Link href="/admin/login" className="inline-block bg-gold-500 hover:bg-gold-600 text-white px-6 py-3 rounded-xl text-sm font-semibold">
              Go to sign in
            </Link>
          </>
        ) : state === 'error' ? (
          <>
            <XCircle size={44} className="text-red-400 mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-white mb-2">Couldn&rsquo;t confirm</h1>
            <p className="text-gray-400 text-sm mb-6">{message}</p>
            <Link href="/admin/security" className="inline-block bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 px-6 py-3 rounded-xl text-sm font-semibold">
              Start again
            </Link>
          </>
        ) : (
          <>
            <ShieldCheck size={44} className="text-gold-400 mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-white mb-2">Confirm password change</h1>
            <p className="text-gray-400 text-sm mb-6">
              Click below to apply your new BILD admin password. If you didn&rsquo;t request this, simply close this page.
            </p>
            <button
              onClick={confirm}
              disabled={!token || state === 'working'}
              className="inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {state === 'working' ? <><Loader2 size={16} className="animate-spin" /> Applying...</> : 'Confirm new password'}
            </button>
            {!token && <p className="text-red-400 text-sm mt-4">This link is missing its token. Please use the link from the email.</p>}
          </>
        )}
      </div>
    </div>
  )
}
