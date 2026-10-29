'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, MessageCircle, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { whatsappDigits } from '@/lib/private-link-format'

// Personal single-use links to a partner's private ticket page (see
// src/lib/private-link.ts). The admin picks who gets one, waiting list or not,
// and sends the message by hand on WhatsApp: nothing is sent from the website.

type Link = {
  id: string
  name: string
  phone: string | null
  created_at: string
  expires_at: string
  opened_at: string | null
  used_at: string | null
  revoked_at: string | null
  live: boolean
  url: string | null
  message: string | null
}
type Waiting = { id: string; name: string; phone: string }

const field = 'w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500'
const btn = 'inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors'

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' })

function statusOf(l: Link): { text: string; tone: string } {
  if (l.revoked_at) return { text: 'Cancelled', tone: 'text-gray-500' }
  if (l.used_at) return { text: `Used ${when(l.used_at)}`, tone: 'text-green-400' }
  if (new Date(l.expires_at) < new Date()) return { text: `Expired ${when(l.expires_at)}`, tone: 'text-amber-400' }
  return {
    text: `${l.opened_at ? `Opened ${when(l.opened_at)}, not used yet` : 'Not opened yet'} · expires ${when(l.expires_at)}`,
    tone: 'text-sky-400',
  }
}

export default function PrivateLinksPanel({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [partnerUrl, setPartnerUrl] = useState('')
  const [savedUrl, setSavedUrl] = useState('')
  const [urlMsg, setUrlMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [links, setLinks] = useState<Link[]>([])
  const [waiting, setWaiting] = useState<Waiting[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [hours, setHours] = useState('48')
  const [waitlistId, setWaitlistId] = useState('')
  const [formError, setFormError] = useState('')

  async function load() {
    const res = await fetch(`/api/admin/events/private-links?eventId=${eventId}`)
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      setLinks(d.links || [])
      setWaiting(d.waiting || [])
      setPartnerUrl(d.privateTicketUrl || '')
      setSavedUrl(d.privateTicketUrl || '')
      setError('')
    } else {
      setError(d.error || 'Could not load the private links.')
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function send(method: string, body: Record<string, unknown>, key: string) {
    setBusy(key)
    const res = await fetch('/api/admin/events/private-links', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    return { ok: res.ok, d }
  }

  async function saveUrl() {
    setUrlMsg(null)
    const { ok, d } = await send('PUT', { eventId, url: partnerUrl }, 'url')
    if (!ok) return setUrlMsg({ ok: false, text: d.error || 'Could not save.' })
    setUrlMsg({ ok: true, text: partnerUrl.trim() ? 'Saved.' : 'Cleared.' })
    load()
  }

  async function create() {
    setFormError('')
    const { ok, d } = await send('POST', { eventId, name, phone, hours: Number(hours), waitlistId: waitlistId || undefined }, 'create')
    if (!ok) return setFormError(d.error || 'Could not make the link.')
    setName(''); setPhone(''); setWaitlistId('')
    load()
  }

  async function act(l: Link, action: 'renew' | 'revoke') {
    if (action === 'revoke' && !confirm(`Cancel ${l.name}'s link? It stops working straight away.`)) return
    if (action === 'renew' && l.live && !confirm(`This replaces ${l.name}'s link, so the old one stops working. Continue?`)) return
    const { ok, d } = await send('POST', { id: l.id, action, hours: Number(hours) }, l.id)
    if (!ok) return setError(d.error || 'That did not work.')
    load()
  }

  async function remove(l: Link) {
    if (!confirm(`Remove ${l.name} from this list? Their link stops working.`)) return
    setBusy(l.id)
    await fetch(`/api/admin/events/private-links?id=${l.id}`, { method: 'DELETE' })
    setBusy(null); load()
  }

  function pickWaiting(id: string) {
    setWaitlistId(id)
    const w = waiting.find(x => x.id === id)
    if (w) { setName(w.name); setPhone(w.phone) }
  }

  if (loading) {
    return <div className="px-6 py-5 text-gray-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</div>
  }

  const usedCount = links.filter(l => l.used_at).length

  return (
    <div className="px-6 py-5">
      <p className="text-gray-500 text-xs mb-4 leading-relaxed">
        For tickets sold through a partner (Ticketsfy) with one private link. Make a personal BILD link for each person
        you choose, waiting list or VIP, and send it yourself on WhatsApp. Each link works once, expires, and only then sends them
        to the partner&rsquo;s page, so the partner&rsquo;s address is never in a message.
      </p>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="mb-5 rounded-xl border border-charcoal-600 px-4 py-3">
        <label htmlFor={`private-ticket-url-${eventId}`} className="text-white text-sm font-semibold mb-0.5 flex items-center gap-1.5">
          <KeyRound size={14} className="text-gold-400" /> Partner&rsquo;s private ticket page
        </label>
        <p className="text-gray-500 text-xs mb-2.5">The one address everyone ends up on. Kept here, never in a message.</p>
        <div className="flex flex-wrap gap-2">
          <input
            id={`private-ticket-url-${eventId}`} type="url" value={partnerUrl} onChange={e => { setPartnerUrl(e.target.value); setUrlMsg(null) }}
            placeholder="https://tickets.ticketsfy.net/..." className={`${field} flex-1 min-w-[220px] w-auto`}
          />
          <button onClick={saveUrl} disabled={busy === 'url' || partnerUrl.trim() === savedUrl}
            className="bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {busy === 'url' ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </button>
        </div>
        {urlMsg && <p className={`text-xs mt-2 ${urlMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{urlMsg.text}</p>}
      </div>

      <div className="mb-5 rounded-xl border border-charcoal-600 px-4 py-3">
        <p className="text-white text-sm font-semibold mb-2.5">Make a link for someone</p>
        {waiting.length > 0 && (
          <div className="mb-3">
            <label htmlFor={`pl-wait-${eventId}`} className="text-gray-400 text-xs block mb-1">Pick from the waitlist (or type a name below)</label>
            <select id={`pl-wait-${eventId}`} value={waitlistId} onChange={e => pickWaiting(e.target.value)} className={field}>
              <option value="">Not from the waitlist</option>
              {waiting.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label htmlFor={`pl-name-${eventId}`} className="text-gray-400 text-xs block mb-1">Name</label>
            <input id={`pl-name-${eventId}`} value={name} onChange={e => { setName(e.target.value); setWaitlistId('') }} placeholder="e.g. Priya Sharma" className={field} />
          </div>
          <div>
            <label htmlFor={`pl-phone-${eventId}`} className="text-gray-400 text-xs block mb-1">WhatsApp number (optional)</label>
            <input id={`pl-phone-${eventId}`} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 50 123 4567" className={field} />
          </div>
          <div>
            <label htmlFor={`pl-hours-${eventId}`} className="text-gray-400 text-xs block mb-1">Link valid for</label>
            <select id={`pl-hours-${eventId}`} value={hours} onChange={e => setHours(e.target.value)} className={field}>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
            </select>
          </div>
        </div>
        <button onClick={create} disabled={busy === 'create' || !partnerUrl.trim() || partnerUrl.trim() !== savedUrl}
          title={savedUrl ? '' : 'Save the partner’s private ticket page first'}
          className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold">
          {busy === 'create' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create link
        </button>
        {!savedUrl && <p className="text-amber-400/90 text-xs mt-2">Save the partner&rsquo;s private ticket page above first.</p>}
        {formError && <p className="text-red-400 text-xs mt-2">{formError}</p>}
      </div>

      {links.length === 0 ? (
        <p className="text-gray-500 text-sm">No links made yet.</p>
      ) : (
        <>
          <p className="text-gray-400 text-xs mb-2">{links.length} link{links.length === 1 ? '' : 's'} made, {usedCount} used</p>
          <div className="space-y-2">
            {links.map(l => {
              const st = statusOf(l)
              const digits = whatsappDigits(l.phone)
              return (
                <div key={l.id} className="bg-charcoal-700/40 rounded-lg px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{l.name}{l.phone ? <span className="text-gray-500 font-normal"> · {l.phone}</span> : null}</p>
                      <p className={`text-xs mt-0.5 ${st.tone}`}>{st.text}</p>
                    </div>
                    <button onClick={() => remove(l)} disabled={busy === l.id} className="text-gray-600 hover:text-red-400 p-1.5 shrink-0" title="Remove from this list">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {l.live && l.message && l.url && (
                      <>
                        <a
                          className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1fb957] text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          href={`https://wa.me/${digits}?text=${encodeURIComponent(l.message)}`} target="_blank" rel="noopener noreferrer"
                          title={digits ? 'Opens WhatsApp with the message ready to send' : 'No number saved: WhatsApp will ask you to choose the contact'}
                        >
                          <MessageCircle size={12} /> Open in WhatsApp
                        </a>
                      </>
                    )}
                    <button className={btn} onClick={() => act(l, 'renew')} disabled={busy === l.id}
                      title="Make a fresh link. The old one stops working.">
                      {busy === l.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {l.live ? 'New link' : 'Make a new link'}
                    </button>
                    {l.live && (
                      <button className={`${btn} hover:text-red-300`} onClick={() => act(l, 'revoke')} disabled={busy === l.id}>Cancel link</button>
                    )}
                  </div>
                  {l.live && !digits && <p className="text-gray-600 text-xs mt-1.5">No number saved, so WhatsApp will ask you to choose the contact.</p>}
                </div>
              )
            })}
          </div>
        </>
      )}

      <p className="text-gray-600 text-xs mt-4 leading-relaxed">
        Nothing is sent from here. Times are Dubai time. Once someone has tapped through to the partner&rsquo;s page they
        could still pass that page&rsquo;s address on, so check &ldquo;Used&rdquo; against the partner&rsquo;s buyer list.
      </p>
    </div>
  )
}
