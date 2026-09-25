'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2, Clock, CheckCircle2, XCircle, Paperclip } from 'lucide-react'
import { uploadViaSignedUrl } from '@/lib/upload-client'
import { btnPrimary } from '@/lib/ui'

const inputBase = 'w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400'
const labelCls = 'block text-sm font-semibold text-charcoal-700 mb-1.5'

export type OwnTestimonial = {
  id: string
  customer_name: string
  quote: string
  status: 'pending' | 'approved' | 'declined'
  decline_reason: string | null
  created_at: string
}

const STATUS = {
  pending:  { label: 'Waiting to be checked', Icon: Clock,        cls: 'bg-gold-500/15 text-gold-700 border-gold-200' },
  approved: { label: 'Live on your profile',  Icon: CheckCircle2, cls: 'bg-green-500/10 text-green-700 border-green-200' },
  declined: { label: 'Not published',         Icon: XCircle,      cls: 'bg-ruby-500/10 text-ruby-600 border-ruby-200' },
} as const

// Lets a business send in testimonials its own customers have given it.
//
// The proof screenshot is required, and is the reason the whole thing is
// moderated: anyone can type a glowing quote about themselves. What an admin
// checks is that a real customer really said it. The screenshot is never shown
// to visitors, only to admins.
export default function BusinessTestimonialsForm({
  token,
  initial,
}: {
  token: string
  initial: OwnTestimonial[]
}) {
  const [items, setItems] = useState<OwnTestimonial[]>(initial)
  const [customerName, setCustomerName] = useState('')
  const [quote, setQuote] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved('')
    if (!customerName.trim()) return setError('Please enter your customer’s name.')
    if (quote.trim().length < 15) return setError('Please enter what your customer said.')
    if (!proof) return setError('Please attach a screenshot of their message as proof.')

    setBusy(true)
    try {
      const up = await uploadViaSignedUrl({ kind: 'testimonial-proof', file: proof, token })
      const res = await fetch('/api/business/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, customerName, quote, proofPath: up.path }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not send that. Please try again.')

      setItems(prev => [{
        id: d.id,
        customer_name: customerName.trim(),
        quote: quote.trim(),
        status: 'pending',
        decline_reason: null,
        created_at: new Date().toISOString(),
      }, ...prev])
      setCustomerName('')
      setQuote('')
      setProof(null)
      setSaved('Sent. We will check it and let you know by email.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that. Please try again.')
    }
    setBusy(false)
  }

  async function withdraw(id: string) {
    if (!confirm('Remove this testimonial?')) return
    setError('')
    const res = await fetch('/api/business/testimonials', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, id }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id))
    else setError(d.error || 'Could not remove that.')
  }

  return (
    <div className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-charcoal-800">Customer Testimonials</h2>
        <p className="text-sm text-charcoal-500 mt-1">
          Send us the kind words your customers have already given you and we will show them on your
          profile page. Attach a screenshot of their original email, WhatsApp or text so we can check
          it is genuine. <strong className="text-charcoal-700">The screenshot is only ever seen by BILD admins</strong>,
          never by visitors.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map(t => {
            const s = STATUS[t.status]
            return (
              <li key={t.id} className="bg-white border border-gold-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal-800 text-sm">{t.customer_name}</p>
                    <p className="text-charcoal-600 text-sm mt-1 italic">&ldquo;{t.quote}&rdquo;</p>
                  </div>
                  {t.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => withdraw(t.id)}
                      className="shrink-0 p-1.5 text-charcoal-400 hover:text-ruby-500 transition-colors"
                      title="Remove"
                      aria-label={`Remove the testimonial from ${t.customer_name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-2.5 py-1 rounded-full border ${s.cls}`}>
                  <s.Icon size={12} /> {s.label}
                </span>
                {t.status === 'declined' && t.decline_reason && (
                  <p className="text-xs text-charcoal-600 mt-2 bg-ruby-500/5 border-l-2 border-ruby-300 pl-3 py-2">
                    <strong>Why:</strong> {t.decline_reason}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={submit} className="space-y-4 border-t border-gold-200 pt-5">
        <div>
          <label className={labelCls} htmlFor="bt-name">Customer&rsquo;s name</label>
          <input
            id="bt-name"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="e.g. Priya Sharma"
            maxLength={80}
            className={inputBase}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="bt-quote">What they said</label>
          <textarea
            id="bt-quote"
            value={quote}
            onChange={e => setQuote(e.target.value)}
            rows={4}
            maxLength={1500}
            placeholder="Paste their words here, exactly as they wrote them."
            className={`${inputBase} resize-none`}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="bt-proof">Proof of the message</label>
          <input
            id="bt-proof"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            onChange={e => setProof(e.target.files?.[0] || null)}
            className="block w-full text-sm text-charcoal-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold-500/15 file:text-gold-700 hover:file:bg-gold-500/25"
          />
          <p className="text-xs text-charcoal-500 mt-1.5 flex items-start gap-1.5">
            <Paperclip size={12} className="mt-0.5 shrink-0" />
            A screenshot of the email, WhatsApp or text. Images or PDF, up to 10 MB.
          </p>
        </div>

        {error && <p className="text-sm text-ruby-600">{error}</p>}
        {saved && <p className="text-sm text-green-700">{saved}</p>}

        <button type="submit" disabled={busy} className={`${btnPrimary} px-5 py-2.5 disabled:opacity-50`}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {busy ? 'Sending' : 'Send for approval'}
        </button>
      </form>
    </div>
  )
}
