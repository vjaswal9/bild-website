'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { btnPrimary } from '@/lib/ui'
import {
  MAHJONG_AREAS, MAHJONG_EXPERIENCE_OPTIONS, MAHJONG_MEMBER_OPTIONS, MAHJONG_NOTES_MAX, MAHJONG_TIMES,
} from '@/lib/mahjong-interest'

const inputBase =
  'w-full px-4 py-2.5 border rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400 transition-colors'
const labelCls = 'block text-sm font-semibold text-charcoal-700 mb-1.5'
const req = <span className="text-ruby-500">*</span>

type Form = {
  fullName: string
  whatsapp: string
  memberStatus: string
  area: string
  experience: string
  availability: string[]
  notes: string
  consent: boolean
  website: string // honeypot: left empty by every real visitor
}

const empty: Form = {
  fullName: '', whatsapp: '', memberStatus: '', area: '', experience: '',
  availability: [], notes: '', consent: false, website: '',
}

// Whether a field is missing, for the red outline after a first attempt.
function missing(f: Form): Record<string, boolean> {
  const digits = f.whatsapp.replace(/\D/g, '')
  return {
    fullName: !f.fullName.trim(),
    whatsapp: digits.length < 8 || digits.length > 15,
    memberStatus: !f.memberStatus,
    area: !f.area,
    experience: !f.experience,
    availability: f.availability.length === 0,
    consent: !f.consent,
  }
}

export default function MahjongInterestForm() {
  const [f, setF] = useState<Form>(empty)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const bad = missing(f)
  const ring = (k: string) => (tried && bad[k] ? 'border-ruby-500 ring-1 ring-ruby-300' : 'border-gold-200')
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(prev => ({ ...prev, [k]: v }))
  const toggleTime = (t: string) =>
    set('availability', f.availability.includes(t) ? f.availability.filter(x => x !== t) : [...f.availability, t])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    setError('')
    if (Object.values(bad).some(Boolean)) {
      setError('Please complete the fields marked in red.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/mahjong-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setDone(true)
    } catch {
      setError('We could not reach the server. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-gold-200 p-8 text-center" role="status">
        <CheckCircle2 className="mx-auto text-green-600 mb-4" size={44} />
        <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-2">Thank you, you are on the list</h2>
        <p className="text-charcoal-600 leading-relaxed max-w-md mx-auto">
          We will message you on WhatsApp once dates, venues and prices are confirmed. There is nothing to pay and
          nothing more to do for now.
        </p>
        <p className="text-sm text-charcoal-600 mt-5">
          Know someone who would love it? Send them{' '}
          <Link href="/mahjong" className="text-gold-700 font-semibold hover:underline">bild.ae/mahjong</Link>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="bg-white rounded-2xl border border-gold-200 p-6 sm:p-8 space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-gold-700 uppercase mb-1">Let us find your table</p>
        <h2 className="font-display text-2xl font-bold text-charcoal-800">Register your interest</h2>
        <p className="text-sm text-charcoal-600 mt-1">About one minute. Fields marked * are required.</p>
      </div>

      <div>
        <label htmlFor="mj-name" className={labelCls}>Full name {req}</label>
        <input id="mj-name" type="text" autoComplete="name" maxLength={120} value={f.fullName}
          onChange={e => set('fullName', e.target.value)} className={`${inputBase} ${ring('fullName')}`} />
      </div>

      <div>
        <label htmlFor="mj-whatsapp" className={labelCls}>WhatsApp number, including country code {req}</label>
        <input id="mj-whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+971 50 123 4567" maxLength={40}
          value={f.whatsapp} onChange={e => set('whatsapp', e.target.value)} className={`${inputBase} ${ring('whatsapp')}`} />
      </div>

      <div>
        <label htmlFor="mj-member" className={labelCls}>Are you a BILD member? {req}</label>
        <select id="mj-member" value={f.memberStatus} onChange={e => set('memberStatus', e.target.value)}
          className={`${inputBase} ${ring('memberStatus')}`}>
          <option value="">Select an option</option>
          {MAHJONG_MEMBER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="mj-area" className={labelCls}>Which area would suit you best? {req}</label>
        <select id="mj-area" value={f.area} onChange={e => set('area', e.target.value)}
          className={`${inputBase} ${ring('area')}`}>
          <option value="">Select a preferred area</option>
          {MAHJONG_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="mj-exp" className={labelCls}>Your Mahjong experience {req}</label>
        <select id="mj-exp" value={f.experience} onChange={e => set('experience', e.target.value)}
          className={`${inputBase} ${ring('experience')}`}>
          <option value="">Select an option</option>
          {MAHJONG_EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <fieldset>
        <legend className={labelCls}>When could you join? {req}</legend>
        <p className="text-xs text-charcoal-600 mb-2">Choose all that suit you</p>
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border p-3 ${ring('availability')}`}>
          {MAHJONG_TIMES.map(t => (
            <label key={t} className="flex items-center gap-2.5 text-sm text-charcoal-700 cursor-pointer py-1">
              <input type="checkbox" checked={f.availability.includes(t)} onChange={() => toggleTime(t)}
                className="h-4 w-4 rounded border-gold-300 accent-gold-500" />
              {t}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="mj-notes" className={labelCls}>Anything else? <span className="font-normal text-charcoal-600">Optional</span></label>
        <textarea id="mj-notes" rows={3} maxLength={MAHJONG_NOTES_MAX} value={f.notes}
          onChange={e => set('notes', e.target.value)} className={`${inputBase} border-gold-200`} />
      </div>

      {/* Honeypot: hidden from people and from screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="mj-website">Website</label>
        <input id="mj-website" type="text" tabIndex={-1} autoComplete="off" value={f.website}
          onChange={e => set('website', e.target.value)} />
      </div>

      <label className={`flex items-start gap-3 text-sm text-charcoal-700 cursor-pointer rounded-xl border p-3 ${ring('consent')}`}>
        <input type="checkbox" checked={f.consent} onChange={e => set('consent', e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gold-300 accent-gold-500" />
        <span>
          I agree that BILD may store these details and contact me on WhatsApp about Mahjong classes and socials.
          My contact details will not be displayed publicly or shared with a teacher without my permission.{' '}
          <Link href="/privacy" className="text-gold-700 font-semibold hover:underline">Privacy Policy</Link> {req}
        </span>
      </label>

      {error && <p role="alert" className="text-sm font-semibold text-ruby-500">{error}</p>}

      <button type="submit" disabled={busy} className={`${btnPrimary} w-full px-6 py-3.5 text-base`}>
        {busy ? <><Loader2 size={18} className="animate-spin" /> Sending</> : 'Register my interest'}
      </button>

      <p className="text-xs text-charcoal-600 text-center">
        An expression of interest only. Dates, pricing and places are subject to confirmation.
      </p>
    </form>
  )
}
