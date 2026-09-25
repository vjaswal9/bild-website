'use client'

import { useState } from 'react'
import { ShieldCheck, Loader2, MailCheck } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'

export default function AdminSecurityPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  async function submit() {
    setError('')
    if (!current || !next) return setError('Please fill in every field.')
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    if (next !== confirm) return setError('The new passwords do not match.')

    setLoading(true)
    const res = await fetch('/api/admin/password/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setSentTo(data.sentTo || 'your admin email')
    } else {
      setError(data.error || 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Security" />

      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2 mb-1">
            <ShieldCheck size={22} className="text-gold-400" /> Change admin password
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            For security, a confirmation link is emailed to the admin address. The password only changes
            after you click that link, so no one can change it from this screen alone.
          </p>

          {sentTo ? (
            <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-5 text-center">
              <MailCheck size={36} className="text-green-400 mx-auto mb-3" />
              <p className="text-white font-semibold">Confirmation email sent</p>
              <p className="text-gray-300 text-sm mt-1">
                We emailed a link to <span className="font-medium">{sentTo}</span>. Open it within 30 minutes
                to finish changing your password. Until then, your current password still works.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <PwField label="Current password" value={current} onChange={setCurrent} />
              <PwField label="New password (min 8 characters)" value={next} onChange={setNext} />
              <PwField label="Confirm new password" value={confirm} onChange={setConfirm} />

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={submit}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending confirmation...</> : 'Email me a confirmation link'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PwField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="new-password"
        className="w-full px-3 py-2.5 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
      />
    </div>
  )
}
