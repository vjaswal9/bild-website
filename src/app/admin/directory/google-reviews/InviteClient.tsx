'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Send, FlaskConical, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import type { InviteRecipient } from '@/lib/google-reviews-link'

type Result = { id?: string; businessName?: string; email?: string; version?: string; ok: boolean; reason?: string }

export default function InviteClient({ recipients, alreadyActive }: {
  recipients: InviteRecipient[]
  alreadyActive: { id: string; businessName: string }[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(recipients.map(r => r.id)))
  const [busy, setBusy] = useState<'' | 'test' | 'send'>('')
  const [testResult, setTestResult] = useState<{ sentTo: string[]; results: Result[] } | null>(null)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; results: Result[] } | null>(null)
  const [error, setError] = useState('')

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  async function run(mode: 'test' | 'send') {
    setError('')
    if (mode === 'send' && !confirm(`Send the Google reviews invitation to ${selected.size} business${selected.size === 1 ? '' : 'es'} now? Each gets its own email.`)) return
    setBusy(mode)
    const res = await fetch('/api/admin/directory/google-reviews-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'send' ? { mode, ids: Array.from(selected) } : { mode }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok && !d.results) return setError(d.error || 'Something went wrong.')
    if (mode === 'test') setTestResult(d)
    else setSendResult(d)
  }

  const brokenCount = recipients.filter(r => r.brokenLink && selected.has(r.id)).length

  return (
    <div className="space-y-6">
      <Link href="/admin/directory" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm">
        <ArrowLeft size={16} /> Back to directory
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-white">Google reviews invitation</h1>
        <p className="text-gray-400 text-sm mt-2 max-w-2xl leading-relaxed">
          Emails each live listing that is not yet showing Google reviews. Each email has a personal button to a page where
          the business pastes its own Google link. Reviews switch on the moment they do, and you are emailed each time.
          Sent from connect@bild.ae.
        </p>
      </div>

      {sendResult ? (
        <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5">
          <p className="text-white font-semibold">
            Sent to {sendResult.sent} business{sendResult.sent === 1 ? '' : 'es'}{sendResult.failed ? `, ${sendResult.failed} failed` : ''}.
          </p>
          <p className="text-gray-500 text-xs mt-1">Every email also appears in the Emails tab with its delivery status.</p>
          <ul className="mt-4 space-y-1.5">
            {sendResult.results.map(r => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                {r.ok ? <CheckCircle2 size={15} className="text-green-400 shrink-0" /> : <XCircle size={15} className="text-red-400 shrink-0" />}
                <span className="text-gray-200">{r.businessName}</span>
                <span className="text-gray-500">{r.email}</span>
                {!r.ok && <span className="text-red-400">{r.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => run('test')}
              disabled={!!busy}
              className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              {busy === 'test' ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />} Send me a test
            </button>
            <button
              onClick={() => run('send')}
              disabled={!!busy || selected.size === 0}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              {busy === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {busy === 'send' ? 'Sending...' : `Send to ${selected.size} business${selected.size === 1 ? '' : 'es'}`}
            </button>
          </div>

          {testResult && (
            <div className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-4 text-sm">
              <p className="text-gray-200">Test sent to {testResult.sentTo.join(', ')}. It contains both versions, and its button opens your own Kudo Advisory page, so trying it changes no customer listing.</p>
              {testResult.results.filter(r => !r.ok).map(r => (
                <p key={r.version} className="text-red-400 mt-1">{r.version} version failed: {r.reason}</p>
              ))}
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-charcoal-700">
                  <th className="px-4 py-3 font-medium w-10"></th>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Version</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map(r => (
                  <tr key={r.id} className="border-b border-charcoal-700/60">
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="accent-gold-500" aria-label={`Include ${r.businessName}`} />
                    </td>
                    <td className="px-4 py-2.5 text-white">{r.businessName}</td>
                    <td className="px-4 py-2.5 text-gray-400">{r.ownerName || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-400">{r.email}</td>
                    <td className="px-4 py-2.5">
                      {r.brokenLink
                        ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">Link did not work</span>
                        : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-charcoal-700 text-gray-300">Standard</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-gray-500 text-xs">
            {selected.size} selected{brokenCount ? `, ${brokenCount} getting the "link did not work" version` : ''}.
            Not emailed because Google reviews are already showing: {alreadyActive.map(a => a.businessName).join(', ') || 'none'}.
          </p>
        </>
      )}
    </div>
  )
}
