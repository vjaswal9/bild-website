'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Loader2, MailCheck, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'

export default function AdminSecurityPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [status, setStatus] = useState<{ personalAccounts: boolean; adminCount: number; errorMonitoringOn: boolean; twoFactorOn: boolean; sessionSecretSeparate: boolean; cronSecretSet: boolean; photoCheckOn: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/admin/security-status').then(r => (r.ok ? r.json() : null)).then(setStatus).catch(() => {})
  }, [])

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

      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
        {status && (
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold text-white mb-3">Protection status</h2>
            <ul className="space-y-3 text-sm">
              <StatusRow
                ok={status.twoFactorOn}
                good="Two-factor login is on for the admin area."
                bad="Two-factor login is off. Set it up in the card below so a password alone cannot open the admin area."
              />
              <StatusRow
                ok={status.sessionSecretSeparate}
                good="Admin sessions are signed with their own secret."
                bad="Admin sessions are signed with the admin password. In Vercel, add a long random ADMIN_SESSION_SECRET (Settings, Environment Variables), then redeploy. You will be asked to sign in again once."
              />
              <StatusRow
                ok={status.cronSecretSet}
                good="Scheduled jobs are locked behind a secret."
                bad="CRON_SECRET is not set, so the scheduled jobs cannot run. Add it in Vercel."
              />
              <StatusRow
                ok={status.errorMonitoringOn}
                good="Error monitoring (Sentry) is on for the live site."
                bad="Error monitoring is off. Add SENTRY_DSN in Vercel so server errors are reported."
              />
              <StatusRow
                ok={status.photoCheckOn}
                good="The automatic photo check is on."
                bad="The automatic photo check is off. Add ANTHROPIC_API_KEY in Vercel."
              />
            </ul>
          </div>
        )}
        {status && !status.personalAccounts && status.twoFactorOn && <UpgradeCard />}
        {status?.personalAccounts && <AdminsCard />}
        <TwoFactorCard personal={!!status?.personalAccounts} />

        {status?.personalAccounts ? <PersonalPasswordCard /> : (
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
        )}
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

function StatusRow({ ok, good, bad }: { ok: boolean; good: string; bad: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok
        ? <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
        : <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />}
      <span className={ok ? 'text-gray-300' : 'text-amber-200'}>{ok ? good : bad}</span>
    </li>
  )
}

type TwoFactorStatus = { available: boolean; enabled: boolean; recoveryCodesLeft: number }

// Two-factor login: scan a QR code with an authenticator app, confirm it works
// by typing a code, then keep the one-time recovery codes somewhere safe.
function TwoFactorCard({ personal }: { personal: boolean }) {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [step, setStep] = useState<'idle' | 'scan' | 'codes' | 'off' | 'move'>('idle')
  const [currentCode, setCurrentCode] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [recovery, setRecovery] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/admin/2fa')
    if (res.ok) setStatus(await res.json())
  }
  useEffect(() => { load() }, [])

  async function post(path: string, body: object) {
    setBusy(true); setError('')
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); return null }
      return data
    } finally { setBusy(false) }
  }

  async function start() {
    const d = await post('/api/admin/2fa/setup', { password, currentCode })
    if (d) { setQr(d.qr); setSecret(d.secret); setPassword(''); setCurrentCode(''); setCode(''); setStep('scan') }
  }
  async function confirm() {
    const d = await post('/api/admin/2fa/enable', { code })
    if (d) { setRecovery(d.recoveryCodes); setCode(''); setQr(''); setSecret(''); setStep('codes') }
  }
  async function turnOff() {
    const d = await post('/api/admin/2fa/disable', { password, code })
    if (d) { setPassword(''); setCode(''); setStep('idle'); load() }
  }
  function finish() { setRecovery([]); setStep('idle'); load() }

  const field = 'w-full px-4 py-3 rounded-xl bg-charcoal-700 border border-charcoal-600 text-white focus:outline-none focus:ring-2 focus:ring-gold-500 placeholder-gray-500'
  const primary = 'inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50'

  if (!status) return null

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2 mb-1">
        <Smartphone size={22} className="text-gold-400" /> Two-factor login
      </h2>

      {!status.available ? (
        <p className="text-amber-200 text-sm mt-2">
          This needs one database update first: run <span className="font-mono">supabase/admin-2fa.sql</span> in Supabase, then refresh this page.
        </p>
      ) : step === 'codes' ? (
        <div className="space-y-4 mt-3">
          <p className="text-green-300 text-sm font-semibold">Two-factor login is now on.</p>
          <p className="text-gray-300 text-sm">
            Save these recovery codes somewhere safe, such as a password manager. Each works once, in place of the
            app code, if you lose your phone. They are shown only now.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm text-white bg-charcoal-900 rounded-xl p-4">
            {recovery.map(c => <span key={c}>{c}</span>)}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button type="button" onClick={() => navigator.clipboard?.writeText(recovery.join('\n'))} className="border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm">Copy codes</button>
            <button type="button" onClick={finish} className={primary}>I have saved them</button>
          </div>
        </div>
      ) : step === 'scan' ? (
        <div className="space-y-4 mt-3">
          <p className="text-gray-300 text-sm">
            1. Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password) and scan this code.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code to scan with your authenticator app" width={240} height={240} className="rounded-xl bg-white p-1" />
          <p className="text-gray-400 text-xs">
            Cannot scan? Enter this key in the app instead: <span className="font-mono text-gray-200 break-all">{secret}</span>
          </p>
          <p className="text-gray-300 text-sm">2. Type the 6-digit code the app now shows to confirm it works.</p>
          <label htmlFor="tf-code" className="sr-only">6-digit code</label>
          <input id="tf-code" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" className={field} />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={confirm} disabled={busy || code.replace(/\s/g, '').length < 6} className={primary}>
              {busy ? <><Loader2 size={16} className="animate-spin" /> Checking...</> : 'Turn on two-factor login'}
            </button>
            <button type="button" onClick={() => { setStep('idle'); setError('') }} className="border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      ) : status.enabled ? (
        <div className="space-y-4 mt-3">
          <p className="flex items-center gap-2 text-green-300 text-sm"><CheckCircle2 size={18} /> On. Signing in needs your password and a code from your phone.</p>
          <p className="text-gray-400 text-sm">{status.recoveryCodesLeft} recovery code{status.recoveryCodesLeft === 1 ? '' : 's'} left.</p>
          {personal ? (
            step === 'move' ? (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm">To move to a new phone, confirm with your password and a current code from your existing app (or a recovery code).</p>
                <label htmlFor="tf-mv-pw" className="block text-sm text-gray-300">Current password</label>
                <input id="tf-mv-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} className={field} />
                <label htmlFor="tf-mv-code" className="block text-sm text-gray-300">Code from your existing app (or a recovery code)</label>
                <input id="tf-mv-code" value={currentCode} onChange={e => setCurrentCode(e.target.value)} autoComplete="one-time-code" className={field} />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={start} disabled={busy || !password || !currentCode} className={primary}>{busy ? 'Checking...' : 'Show the new QR code'}</button>
                  <button type="button" onClick={() => { setStep('idle'); setError('') }} className="border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => { setStep('move'); setError('') }} className="border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm">Move to a new phone...</button>
            )
          ) : step === 'off' ? (
            <div className="space-y-3">
              <label htmlFor="tf-off-pw" className="block text-sm text-gray-300">Current password</label>
              <input id="tf-off-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} className={field} />
              <label htmlFor="tf-off-code" className="block text-sm text-gray-300">Code from your app (or a recovery code)</label>
              <input id="tf-off-code" value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" className={field} />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={turnOff} disabled={busy || !password || !code} className={primary}>{busy ? 'Turning off...' : 'Turn off two-factor login'}</button>
                <button type="button" onClick={() => { setStep('idle'); setError('') }} className="border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setStep('off'); setError('') }} className="border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm">Turn off...</button>
          )}
        </div>
      ) : (
        <div className="space-y-4 mt-3">
          <p className="text-gray-400 text-sm">
            Adds a second step to signing in: a 6-digit code from an app on your phone. A stolen or guessed password
            alone then cannot open the admin area.
          </p>
          <label htmlFor="tf-pw" className="block text-sm text-gray-300">Confirm your password to begin</label>
          <input id="tf-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className={field} />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="button" onClick={start} disabled={busy || !password} className={primary}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Starting...</> : 'Set up two-factor login'}
          </button>
        </div>
      )}
    </div>
  )
}

// Switch from the single shared login to a personal account for the person
// signed in now. Offered only while the shared login is in use and two-factor
// is already on.
function UpgradeCard() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const field = 'w-full px-4 py-3 rounded-xl bg-charcoal-700 border border-charcoal-600 text-white focus:outline-none focus:ring-2 focus:ring-gold-500 placeholder-gray-500'

  async function go() {
    setBusy(true); setError('')
    const res = await fetch('/api/admin/account/upgrade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) })
    const d = await res.json().catch(() => ({}))
    if (res.ok) { window.location.reload(); return }
    setError(d.error || 'Something went wrong. Please try again.'); setBusy(false)
  }

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold text-white mb-1">Personal admin accounts</h2>
      <p className="text-gray-400 text-sm mb-4">
        Right now everyone shares one password and one authenticator. Switching to personal accounts gives each admin
        their own email, password and authenticator, and lets you add or remove people individually. You keep your
        current password and authenticator; sign-in just asks for your email too.
      </p>
      <div className="space-y-3">
        <label htmlFor="up-name" className="block text-sm text-gray-300">Your name</label>
        <input id="up-name" value={name} onChange={e => setName(e.target.value)} className={field} />
        <label htmlFor="up-email" className="block text-sm text-gray-300">Your email address (you will sign in with this)</label>
        <input id="up-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" className={field} />
        <label htmlFor="up-pw" className="block text-sm text-gray-300">Your current admin password</label>
        <input id="up-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className={field} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="button" onClick={go} disabled={busy || !name || !email || !password} className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Switching...</> : 'Switch to personal accounts'}
        </button>
      </div>
    </div>
  )
}

type AdminRow = { id: string; email: string; name: string; active: boolean; last_login_at: string | null; invite_expires_at: string | null }

// Everyone with admin access, with add, resend and remove.
function AdminsCard() {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [me, setMe] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const field = 'w-full px-4 py-3 rounded-xl bg-charcoal-700 border border-charcoal-600 text-white focus:outline-none focus:ring-2 focus:ring-gold-500 placeholder-gray-500'
  const ghost = 'border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-3 py-1.5 rounded-lg text-xs'

  async function load() {
    const res = await fetch('/api/admin/users')
    if (!res.ok) return
    const d = await res.json()
    setAdmins(d.admins || []); setMe(d.currentId || '')
  }
  useEffect(() => { load() }, [])

  async function call(method: 'POST' | 'DELETE' | 'PATCH', body: object): Promise<boolean> {
    setBusy(true); setError(''); setNote('')
    try {
      const res = await fetch('/api/admin/users', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Something went wrong. Please try again.'); return false }
      return true
    } finally { setBusy(false) }
  }

  async function invite() {
    if (await call('POST', { name, email, password })) {
      setAdding(false); setName(''); setEmail(''); setPassword(''); setNote('Invitation sent. The link works once and expires in 48 hours.'); load()
    }
  }
  async function remove(id: string) {
    if (await call('DELETE', { id, password })) { setRemoving(null); setPassword(''); setNote('Removed. They have been signed out everywhere.'); load() }
  }
  async function resend(id: string) {
    if (await call('PATCH', { id })) setNote('Invitation sent again. The old link no longer works.')
  }

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold text-white mb-1">Admins</h2>
      <p className="text-gray-400 text-sm mb-4">Everyone below can use every part of the admin area, including Money. Each signs in with their own email, password and authenticator.</p>

      <ul className="divide-y divide-charcoal-700 mb-4">
        {admins.map(a => (
          <li key={a.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{a.name || a.email}{a.id === me && <span className="text-gold-400 text-xs ml-2">you</span>}</p>
              <p className="text-gray-400 text-xs truncate">{a.email}</p>
              <p className="text-gray-500 text-xs">
                {a.active
                  ? (a.last_login_at ? `Last signed in ${new Date(a.last_login_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Never signed in')
                  : 'Invitation pending, not yet accepted'}
              </p>
            </div>
            {a.id !== me && (
              <div className="flex gap-2">
                {!a.active && <button type="button" onClick={() => resend(a.id)} disabled={busy} className={ghost}>Resend invite</button>}
                <button type="button" onClick={() => { setRemoving(a.id); setPassword(''); setError('') }} disabled={busy} className={ghost}>{a.active ? 'Remove' : 'Cancel invite'}</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {removing && (
        <div className="space-y-3 mb-4 p-4 rounded-xl border border-charcoal-600">
          <p className="text-gray-300 text-sm">Confirm with your password to remove {admins.find(a => a.id === removing)?.name || 'this person'}.</p>
          <label htmlFor="rm-pw" className="sr-only">Your password</label>
          <input id="rm-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your password" className={field} />
          <div className="flex gap-3">
            <button type="button" onClick={() => remove(removing)} disabled={busy || !password} className="bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">{busy ? 'Removing...' : 'Remove'}</button>
            <button type="button" onClick={() => { setRemoving(null); setError('') }} className="border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {adding ? (
        <div className="space-y-3">
          <label htmlFor="ad-name" className="block text-sm text-gray-300">Their name</label>
          <input id="ad-name" value={name} onChange={e => setName(e.target.value)} className={field} />
          <label htmlFor="ad-email" className="block text-sm text-gray-300">Their email address</label>
          <input id="ad-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={field} />
          <label htmlFor="ad-pw" className="block text-sm text-gray-300">Your password, to confirm</label>
          <input id="ad-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className={field} />
          <div className="flex gap-3">
            <button type="button" onClick={invite} disabled={busy || !name || !email || !password} className="bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">{busy ? 'Sending...' : 'Send invitation'}</button>
            <button type="button" onClick={() => { setAdding(false); setError('') }} className="border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        !removing && <button type="button" onClick={() => { setAdding(true); setPassword(''); setError(''); setNote('') }} className="bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">Add an admin</button>
      )}
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      {note && <p className="text-green-300 text-sm mt-3">{note}</p>}
    </div>
  )
}

// A personal account changes its own password: current password plus a current
// authenticator code. Replaces the emailed-link flow used by the shared login.
function PersonalPasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit() {
    setError('')
    if (next.length < 12) return setError('The new password must be at least 12 characters.')
    if (next !== again) return setError('The new passwords do not match.')
    setBusy(true)
    const res = await fetch('/api/admin/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: current, newPassword: next, code }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) { setDone(true); setCurrent(''); setNext(''); setAgain(''); setCode('') } else setError(d.error || 'Something went wrong. Please try again.')
  }

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2 mb-1">
        <ShieldCheck size={22} className="text-gold-400" /> Change my password
      </h2>
      <p className="text-gray-400 text-sm mb-4">This changes your own password only. Your other signed-in devices will be signed out.</p>
      {done ? (
        <p className="text-green-300 text-sm">Password changed.</p>
      ) : (
        <div className="space-y-4">
          <PwField label="Current password" value={current} onChange={setCurrent} />
          <PwField label="New password (min 12 characters)" value={next} onChange={setNext} />
          <PwField label="Confirm new password" value={again} onChange={setAgain} />
          <div>
            <label htmlFor="pw-code" className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Code from your authenticator app</label>
            <input id="pw-code" value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" className="w-full px-3 py-2.5 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="button" onClick={submit} disabled={busy || !current || !next || !code} className="w-full inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Change my password'}
          </button>
        </div>
      )}
    </div>
  )
}
