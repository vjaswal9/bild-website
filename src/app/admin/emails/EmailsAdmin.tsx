'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, Loader2, RefreshCw, X, ExternalLink, AlertTriangle, Mail, Send, Check,
} from 'lucide-react'
import ModalPortal from '@/components/ui/ModalPortal'

type Row = {
  id: string
  to: string[]
  cc: string[]
  bcc: string[]
  from: string
  subject: string
  status: string
  createdAt: string
}

// Resend's own vocabulary, grouped by what an admin actually needs to notice.
// Anything that did not reach the person is red, because that is the whole
// reason to look at this screen.
const TONE: Record<string, { label: string; cls: string }> = {
  delivered:        { label: 'Delivered',  cls: 'bg-green-500/15 text-green-400' },
  opened:           { label: 'Opened',     cls: 'bg-green-500/15 text-green-300' },
  clicked:          { label: 'Clicked',    cls: 'bg-green-500/15 text-green-300' },
  sent:             { label: 'Sent',       cls: 'bg-blue-500/15 text-blue-300' },
  queued:           { label: 'Queued',     cls: 'bg-charcoal-700 text-gray-400' },
  scheduled:        { label: 'Scheduled',  cls: 'bg-charcoal-700 text-gray-400' },
  delivery_delayed: { label: 'Delayed',    cls: 'bg-amber-500/15 text-amber-300' },
  bounced:          { label: 'Bounced',    cls: 'bg-red-500/15 text-red-400' },
  failed:           { label: 'Failed',     cls: 'bg-red-500/15 text-red-400' },
  complained:       { label: 'Complained', cls: 'bg-red-500/15 text-red-400' },
  suppressed:       { label: 'Suppressed', cls: 'bg-red-500/15 text-red-400' },
  canceled:         { label: 'Cancelled',  cls: 'bg-charcoal-700 text-gray-500' },
}
const FAILED = new Set(['bounced', 'failed', 'complained', 'suppressed'])

const when = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
  })
}

export default function EmailsAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [only, setOnly] = useState<'all' | 'problems' | 'events'>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async (after?: string) => {
    if (after) setLoadingMore(true)
    else setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/emails?limit=50${after ? `&after=${after}` : ''}`)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(d.error || 'Could not load emails.')
    } else {
      setRows(prev => (after ? [...prev, ...d.emails] : d.emails))
      setHasMore(!!d.hasMore)
      setCursor(d.nextCursor)
    }
    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (only === 'problems' && !FAILED.has(r.status)) return false
      if (only === 'events' && !r.from.toLowerCase().includes('events@')) return false
      if (!q) return true
      return (
        r.subject.toLowerCase().includes(q) ||
        r.to.join(' ').toLowerCase().includes(q) ||
        r.from.toLowerCase().includes(q)
      )
    })
  }, [rows, search, only])

  const problems = rows.filter(r => FAILED.has(r.status)).length
  const [composing, setComposing] = useState(false)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Emails</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-xl">
            Every email BILD has sent, taken live from Resend, with what actually happened to it.{' '}
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noreferrer"
              className="text-gold-400 hover:underline inline-flex items-center gap-1"
            >
              Open in Resend <ExternalLink size={12} />
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setComposing(v => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              composing ? 'bg-gold-500 text-white' : 'bg-gold-500/15 hover:bg-gold-500/25 text-gold-400'
            }`}
          >
            <Send size={16} /> Write to someone
          </button>
          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
          </button>
        </div>
      </div>

      {composing && <Compose onClose={() => setComposing(false)} onSent={() => load()} />}

      {problems > 0 && only !== 'problems' && (
        <button
          onClick={() => setOnly('problems')}
          className="w-full text-left bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-5 hover:bg-red-500/15 transition-colors"
        >
          <p className="text-red-300 font-semibold text-sm inline-flex items-center gap-2">
            <AlertTriangle size={15} />
            {problems} of the last {rows.length} emails did not reach the recipient
          </p>
          <p className="text-red-200/70 text-sm mt-1">
            Usually a mistyped address. The payment still went through. Show them.
          </p>
        </button>
      )}

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by recipient, subject or sender"
            className="w-full bg-charcoal-800 border border-charcoal-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500"
          />
        </div>
        {([
          ['all', 'All'],
          ['problems', 'Not delivered'],
          ['events', 'Events only'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setOnly(key)}
            className={`px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              only === key ? 'bg-gold-500 text-white' : 'bg-charcoal-800 text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-8 text-center">
          <p className="text-red-400 font-semibold">Could not load emails</p>
          <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto leading-relaxed">{error}</p>
        </div>
      ) : loading ? (
        <p className="text-gray-500 text-sm py-16 text-center inline-flex items-center gap-2 justify-center w-full">
          <Loader2 size={15} className="animate-spin" /> Loading from Resend...
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-16 text-center">
          {rows.length === 0 ? 'No emails sent yet.' : 'Nothing matches that filter.'}
        </p>
      ) : (
        <>
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
            {filtered.map((r, i) => {
              const tone = TONE[r.status] || { label: r.status, cls: 'bg-charcoal-700 text-gray-400' }
              return (
                <button
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className={`w-full text-left flex items-start gap-4 px-4 py-3 hover:bg-charcoal-700/50 transition-colors ${
                    i > 0 ? 'border-t border-charcoal-700' : ''
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shrink-0 mt-0.5 w-24 text-center ${tone.cls}`}>
                    {tone.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-white text-sm font-medium truncate">{r.subject}</span>
                    <span className="block text-gray-500 text-xs truncate mt-0.5">
                      to {r.to.join(', ') || 'nobody'}
                      {r.cc.length > 0 && ` · cc ${r.cc.join(', ')}`}
                      {r.bcc.length > 0 && ` · bcc ${r.bcc.join(', ')}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-gray-400 text-xs whitespace-nowrap">{when(r.createdAt)}</span>
                    <span className="block text-gray-600 text-[11px] truncate max-w-[160px]">
                      {r.from.replace(/.*<|>.*/g, '')}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-3 mt-4">
            <p className="text-gray-500 text-xs">
              Showing {filtered.length}
              {filtered.length !== rows.length && ` of ${rows.length} loaded`}
            </p>
            {hasMore && (
              <button
                onClick={() => cursor && load(cursor)}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                {loadingMore && <Loader2 size={14} className="animate-spin" />} Load 50 more
              </button>
            )}
          </div>
        </>
      )}

      {openId && <EmailDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

// The email as the recipient saw it. Rendered in a sandboxed frame: the body
// is HTML that BILD generated, but it is loaded from an external service and
// injecting it into the admin page directly would let it run scripts here.
function EmailDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [email, setEmail] = useState<{
    subject: string; from: string; to: string[]; cc: string[] | null; bcc: string[] | null
    html: string | null; text: string | null; created_at: string; last_event: string
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/emails?id=${id}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else setEmail(d.email)
      })
      .catch(() => !cancelled && setError('Could not load the email.'))
    return () => { cancelled = true }
  }, [id])

  return (
    <ModalPortal onClose={onClose}>
      <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
        <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl w-full max-w-2xl my-8">
          <div className="flex items-start justify-between gap-4 p-5 border-b border-charcoal-700">
            <div className="min-w-0">
              <p className="text-white font-semibold">{email?.subject || 'Loading...'}</p>
              {email && (
                <p className="text-gray-500 text-xs mt-1">
                  From {email.from} · to {email.to.join(', ')}
                  {email.cc?.length ? ` · cc ${email.cc.join(', ')}` : ''}
                  {email.bcc?.length ? ` · bcc ${email.bcc.join(', ')}` : ''}
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white shrink-0" aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div className="p-5">
            {error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : !email ? (
              <p className="text-gray-500 text-sm inline-flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> Loading...
              </p>
            ) : email.html ? (
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={email.html}
                className="w-full h-[60vh] rounded-xl bg-white border border-charcoal-600"
              />
            ) : (
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
                {email.text || 'No content recorded.'}
              </pre>
            )}
          </div>

          <div className="px-5 py-3 border-t border-charcoal-700 flex items-center justify-between gap-3">
            <p className="text-gray-500 text-xs inline-flex items-center gap-1.5">
              <Mail size={12} /> {email ? when(email.created_at) : ''}
            </p>
            <a
              href={`https://resend.com/emails/${id}`}
              target="_blank"
              rel="noreferrer"
              className="text-gold-400 hover:underline text-xs inline-flex items-center gap-1"
            >
              Open in Resend <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// Ready-made messages for situations that come up and have no automated email
// behind them. Picking one fills the form in, so nothing has to be retyped or
// pasted in from somewhere else. Everything stays editable before sending.
const SAVED_MESSAGES: { id: string; label: string; to: string; subject: string; body: string }[] = [
  {
    id: 'garba-booking-fault',
    label: 'Garba 2026: apology for the child ticket fault',
    to: 'shoba_supeda1@hotmail.com, reenzp@hotmail.co.uk',
    subject: 'BILD Garba 2026: sorry, the fault was ours',
    body: `Hello,

You tried to book tickets for BILD Garba 2026 and the child tickets would not go through. I am sorry about that. It was a fault on our booking page, not anything you did.

Once a booking went past ten people our page was quietly dropping the extra tickets, and the ones it dropped were always the ones added last. That is why the children and under 5s kept disappearing while the adult tickets stayed.

It is now fixed. You can book up to twenty people in one go, with adults, 6 to 11s and under 5s all together, and nothing gets lost on the way to payment.

https://www.bild.ae/events/bild-garba-2026

There are still places left. If you would rather we put the booking through for you, or your group is bigger than twenty, just reply to this email and we will sort it out.

Sorry again for the run around, and we hope to see you on the dance floor.

Truna
BILD`,
  },
]

function Compose({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ sent: string[]; failed: { to: string; error?: string }[]; bcc: string[] } | null>(null)

  function loadSaved(id: string) {
    const m = SAVED_MESSAGES.find(x => x.id === id)
    if (!m) return
    setTo(m.to)
    setSubject(m.subject)
    setBody(m.body)
    setResult(null)
    setError('')
  }

  async function send() {
    setError('')
    setBusy(true)
    const res = await fetch('/api/admin/emails/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok && !d.sent) return setError(d.error || 'Could not send.')
    setResult(d)
    onSent()
  }

  const field = 'w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500'

  if (result) {
    return (
      <div className="bg-charcoal-800 border border-charcoal-600 rounded-2xl p-5 mb-5">
        {result.sent.length > 0 && (
          <p className="text-green-400 text-sm font-semibold inline-flex items-center gap-2">
            <Check size={16} /> Sent to {result.sent.join(', ')}
          </p>
        )}
        {result.failed.length > 0 && (
          <div className="mt-2">
            {result.failed.map(f => (
              <p key={f.to} className="text-red-400 text-sm">Could not send to {f.to}. {f.error}</p>
            ))}
          </div>
        )}
        <p className="text-gray-500 text-xs mt-2">
          Sent from events@bild.ae, blind copied to {result.bcc.join(', ')}. Each person received their own copy and
          cannot see the others. It will appear in the list below after a refresh.
        </p>
        <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white">
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="bg-charcoal-800 border border-charcoal-600 rounded-2xl p-5 mb-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <p className="text-white font-semibold">Write to someone</p>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
      </div>
      <p className="text-gray-500 text-xs mb-4">
        Goes out from events@bild.ae with BILD branding, so a reply comes back to the events inbox. Everyone listed
        gets their own copy and cannot see the other recipients.
      </p>

      <label className="block mb-3">
        <span className="text-gray-400 text-xs block mb-1">Start from a saved message</span>
        <select
          defaultValue=""
          onChange={e => loadSaved(e.target.value)}
          className={field}
        >
          <option value="">Write my own</option>
          {SAVED_MESSAGES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>

      <label className="block mb-3">
        <span className="text-gray-400 text-xs block mb-1">To (separate addresses with a comma)</span>
        <input value={to} onChange={e => setTo(e.target.value)} className={field} placeholder="someone@email.com" />
      </label>

      <label className="block mb-3">
        <span className="text-gray-400 text-xs block mb-1">Subject</span>
        <input value={subject} onChange={e => setSubject(e.target.value)} className={field} />
      </label>

      <label className="block mb-3">
        <span className="text-gray-400 text-xs block mb-1">Message</span>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={14}
          className={`${field} font-sans leading-relaxed`}
          placeholder="Plain text. Leave a blank line between paragraphs."
        />
      </label>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={send}
          disabled={busy || !to.trim() || !subject.trim() || !body.trim()}
          className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  )
}
