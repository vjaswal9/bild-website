'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { Loader2, CheckCircle2 } from 'lucide-react'

// Where an invited admin lands from the emailed link: choose a password, scan
// a QR code with an authenticator app, confirm a code, save recovery codes.
export default function AdminInvitePage() {
  const { token } = useParams<{ token: string }>()
  const [step, setStep] = useState<'password' | 'scan' | 'codes'>('password')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [code, setCode] = useState('')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [who, setWho] = useState({ name: '', email: '' })
  const [recovery, setRecovery] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function post(path: string, body: object) {
    setBusy(true); setError('')
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); return null }
      return data
    } finally { setBusy(false) }
  }

  async function choosePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 12) return setError('Your password must be at least 12 characters.')
    if (password !== again) return setError('The two passwords do not match.')
    const d = await post('/api/admin/invite/start', { token, password })
    if (d) { setQr(d.qr); setSecret(d.secret); setWho({ name: d.name, email: d.email }); setStep('scan') }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault()
    const d = await post('/api/admin/invite/finish', { token, code })
    if (d) { setRecovery(d.recoveryCodes); setStep('codes') }
  }

  const field = 'w-full px-4 py-3 rounded-xl bg-charcoal-700 border border-charcoal-600 text-white focus:outline-none focus:ring-2 focus:ring-gold-500 placeholder-gray-500'
  const primary = 'w-full inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50'

  return (
    <div className="min-h-screen bg-charcoal-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/bild-logo-new.svg" alt="BILD" width={120} height={75} className="h-16 w-auto object-contain mx-auto mb-4 brightness-0 invert" />
          <h1 className="font-display text-2xl font-bold text-white">Set up your admin access</h1>
          <p className="text-gray-400 text-sm mt-1">
            {step === 'password' ? 'Step 1 of 2: choose a password' : step === 'scan' ? 'Step 2 of 2: connect your authenticator app' : 'You are signed in'}
          </p>
        </div>

        <div className="bg-charcoal-800 rounded-2xl p-8 space-y-4">
          {step === 'password' && (
            <form onSubmit={choosePassword} className="space-y-4">
              <p className="text-gray-300 text-sm">Choose a password for signing in to the BILD admin area. Use at least 12 characters, and one you do not use anywhere else.</p>
              <div>
                <label htmlFor="inv-pw" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input id="inv-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className={field} required />
              </div>
              <div>
                <label htmlFor="inv-pw2" className="block text-sm font-medium text-gray-300 mb-2">Type it again</label>
                <input id="inv-pw2" type="password" value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" className={field} required />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={busy} className={primary}>{busy ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Continue'}</button>
            </form>
          )}

          {step === 'scan' && (
            <form onSubmit={confirmCode} className="space-y-4">
              <p className="text-gray-300 text-sm">Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password) and scan this code. Make sure your phone&apos;s clock is set to automatic.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code to scan with your authenticator app" width={240} height={240} className="rounded-xl bg-white p-1 mx-auto" />
              <p className="text-gray-400 text-xs text-center">Cannot scan? Enter this key in the app: <span className="font-mono text-gray-200 break-all">{secret}</span></p>
              <label htmlFor="inv-code" className="block text-sm font-medium text-gray-300">Then type the 6-digit code the app shows</label>
              <input id="inv-code" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" className={`${field} text-center tracking-widest`} required />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={busy || code.replace(/\s/g, '').length < 6} className={primary}>{busy ? <><Loader2 size={16} className="animate-spin" /> Checking...</> : 'Finish setting up'}</button>
            </form>
          )}

          {step === 'codes' && (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-green-300 text-sm font-semibold"><CheckCircle2 size={18} /> Welcome{who.name ? `, ${who.name.split(' ')[0]}` : ''}. Your access is ready.</p>
              <p className="text-gray-300 text-sm">Save these recovery codes somewhere safe, such as a password manager. Each works once, in place of the app code, if you lose your phone. They are shown only now.</p>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm text-white bg-charcoal-900 rounded-xl p-4">
                {recovery.map(c => <span key={c}>{c}</span>)}
              </div>
              <p className="text-gray-400 text-xs">From now on sign in at bild.ae/admin with {who.email}, your password and a code from your app.</p>
              <div className="flex gap-3 flex-wrap">
                <button type="button" onClick={() => navigator.clipboard?.writeText(recovery.join('\n'))} className="border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm">Copy codes</button>
                <a href="/admin" className="flex-1 inline-flex items-center justify-center bg-gold-500 hover:bg-gold-600 text-white py-2.5 rounded-xl font-semibold text-sm">I have saved them, open the admin area</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
