'use client'

import { useEffect, useState } from 'react'
import { Loader2, Send, Mail, CheckCircle2, AlertTriangle } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'

type Biz = {
  id: string
  businessName: string
  email: string
  featured: boolean
  live: boolean
  neverPaid: boolean
}

// Emails businesses their manage link, which is how they send in customer
// testimonials.
//
// Deliberately a chooser rather than one "email everybody" button: this sends
// to real businesses and cannot be taken back, so who receives it is an
// explicit decision each time. Businesses whose listing is not live start
// unticked, because inviting someone to add testimonials to a profile nobody
// can see reads badly.
export default function ManageLinkInvite() {
  const [rows, setRows] = useState<Biz[]>([])
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'' | 'test' | 'send'>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/directory/manage-link-invite')
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        const list: Biz[] = d.businesses || []
        setRows(list)
        setChosen(new Set(list.filter(b => b.live).map(b => b.id)))
      } else setError(d.error || 'Could not load the list.')
      setLoading(false)
    })()
  }, [])

  function toggle(id: string) {
    setChosen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function sendTest() {
    setBusy('test'); setNote(''); setError('')
    const res = await fetch('/api/admin/directory/manage-link-invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'test' }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy('')
    if (res.ok) setNote(`Both versions sent to ${Array.isArray(d.sentTo) ? d.sentTo.join(', ') : d.sentTo}. Check them before sending to anyone else.`)
    else setError(d.error || 'Could not send the test.')
  }

  async function sendReal() {
    const names = rows.filter(b => chosen.has(b.id))
    if (names.length === 0) return setError('Nobody is selected.')
    if (!confirm(`Email the manage link to ${names.length} ${names.length === 1 ? 'business' : 'businesses'}?\n\nThis goes to real businesses and cannot be undone.`)) return

    setBusy('send'); setNote(''); setError('')
    const res = await fetch('/api/admin/directory/manage-link-invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'send', ids: Array.from(chosen) }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy('')
    if (res.ok) {
      setNote(`Sent to ${d.sent} ${d.sent === 1 ? 'business' : 'businesses'}${d.failed ? `, ${d.failed} failed` : ''}.`)
      if (d.failed) {
        const bad = (d.results || []).filter((r: { ok: boolean }) => !r.ok)
          .map((r: { businessName: string; reason?: string }) => `${r.businessName}: ${r.reason || 'unknown'}`)
        setError(`Did not send to:\n${bad.join('\n')}`)
      }
    } else setError(d.error || 'Could not send.')
  }

  const liveCount = rows.filter(b => b.live).length

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Manage links" />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Send manage links</h1>
        <p className="text-gray-400 text-sm mb-6">
          Emails each business its own link for sending in customer testimonials. Featured businesses get
          the version that also mentions their bio, gallery, video, offers and brochure.
        </p>

        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={sendTest}
            disabled={busy !== ''}
            className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
            Send me both versions first
          </button>
          <button
            onClick={sendReal}
            disabled={busy !== '' || chosen.size === 0}
            className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {busy === 'send' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send to {chosen.size} selected
          </button>
        </div>

        {note && <p className="text-green-400 text-sm mb-4 flex items-start gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{note}</p>}
        {error && <p className="text-red-400 text-sm mb-4 whitespace-pre-line flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}</p>}

        {loading ? (
          <p className="text-gray-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 text-xs">
                {rows.length} businesses, {liveCount} live. Listings that are not live start unticked.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setChosen(new Set(rows.map(r => r.id)))} className="text-gold-400 text-xs hover:underline">Select all</button>
                <button onClick={() => setChosen(new Set())} className="text-gray-500 text-xs hover:underline">Clear</button>
              </div>
            </div>

            <ul className="divide-y divide-charcoal-700 border border-charcoal-700 rounded-xl overflow-hidden">
              {rows.map(b => (
                <li key={b.id} className="bg-charcoal-800">
                  <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-charcoal-700/50 transition-colors">
                    <input
                      id={`biz-${b.id}`}
                      type="checkbox"
                      checked={chosen.has(b.id)}
                      onChange={() => toggle(b.id)}
                      className="h-4 w-4 accent-gold-500 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-white text-sm font-medium truncate">{b.businessName}</span>
                      <span className="block text-gray-500 text-xs truncate">{b.email}</span>
                    </span>
                    <span className="flex gap-1.5 shrink-0">
                      {b.featured && <span className="text-[10px] font-semibold uppercase tracking-wide bg-gold-500/20 text-gold-300 px-2 py-0.5 rounded-full">Featured</span>}
                      {!b.live && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
                          {b.neverPaid ? 'Never paid' : 'Not live'}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
