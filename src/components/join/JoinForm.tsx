'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldCheck, XCircle, ArrowRight, ArrowLeft, Lock, Check, Pencil, Clock, Save } from 'lucide-react'

const inputBase =
  'w-full px-4 py-2.5 border rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400 transition-colors'
const labelCls = 'block text-sm font-semibold text-charcoal-700 mb-1.5'
const req = <span className="text-ruby-500">*</span>
const STORAGE_KEY = 'bild_join_v1'

type Data = Record<string, string>

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const isPhone = (v: string) => v.replace(/\D/g, '').length >= 9

// ---- small field components ----
function TextField({ label, value, onChange, required, type = 'text', placeholder, hint, showError, validate }: {
  label: React.ReactNode; value: string; onChange: (v: string) => void; required?: boolean
  type?: string; placeholder?: string; hint?: string; showError?: boolean; validate?: (v: string) => boolean
}) {
  const filled = value.trim().length > 0
  const valid = filled && (validate ? validate(value) : true)
  const invalid = showError && ((required && !filled) || (filled && validate && !validate(value)))
  return (
    <div>
      <label className={labelCls}>{label} {required && req}</label>
      <div className="relative">
        <input
          type={type} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className={`${inputBase} ${invalid ? 'border-ruby-500 ring-1 ring-ruby-300' : valid ? 'border-green-400' : 'border-gold-200'} pr-9`}
        />
        {valid && <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
      </div>
      {hint && !invalid && <p className="text-xs text-charcoal-400 mt-1">{hint}</p>}
      {invalid && <p className="text-xs text-ruby-500 mt-1">{!filled ? 'This field is required.' : 'Please enter a valid value.'}</p>}
    </div>
  )
}

function PhoneField({ label, value, onChange, required, showError }: {
  label: React.ReactNode; value: string; onChange: (v: string) => void; required?: boolean; showError?: boolean
}) {
  const local = value.replace(/^\+971\s?/, '')
  const valid = isPhone(value) && local.length > 0
  const invalid = showError && required && !valid
  return (
    <div>
      <label className={labelCls}>{label} {required && req}</label>
      <div className={`flex items-stretch rounded-xl border ${invalid ? 'border-ruby-500' : valid ? 'border-green-400' : 'border-gold-200'} overflow-hidden bg-white focus-within:ring-2 focus-within:ring-gold-400`}>
        <span className="px-3 flex items-center bg-gold-100 text-charcoal-600 text-sm font-medium border-r border-gold-200">+971</span>
        <input
          type="tel" inputMode="numeric" value={local}
          placeholder="50 123 4567"
          onChange={e => onChange('+971 ' + e.target.value.replace(/[^\d\s]/g, ''))}
          className="flex-1 px-3 py-2.5 bg-white text-charcoal-800 focus:outline-none"
        />
        {valid && <span className="px-3 flex items-center"><Check size={16} className="text-green-500" /></span>}
      </div>
      {invalid && <p className="text-xs text-ruby-500 mt-1">Enter a valid UAE mobile number.</p>}
    </div>
  )
}

function Toggle({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(([v, lbl]) => (
        <button type="button" key={v} onClick={() => onChange(v)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${value === v ? 'bg-gold-500 text-white border-gold-500 shadow-sm' : 'bg-white text-charcoal-700 border-gold-200 hover:border-gold-300'}`}>
          {lbl}
        </button>
      ))}
    </div>
  )
}

const YEARS = Array.from({ length: 86 }, (_, i) => `${2010 - i}`)

export default function JoinForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [ineligible, setIneligible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tried1, setTried1] = useState(false)
  const [tried2, setTried2] = useState(false)
  const [d, setD] = useState<Data>({})
  const [loaded, setLoaded] = useState(false)
  const step2Ref = useRef<HTMLFormElement>(null)

  const set = (k: string, v: string) => setD(prev => ({ ...prev, [k]: v }))

  // Autosave: restore on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.d) setD(saved.d)
        if (saved.step) setStep(saved.step)
      }
    } catch {}
    setLoaded(true)
  }, [])

  // Autosave: persist on change
  useEffect(() => {
    if (loaded) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ d, step })) } catch {}
    }
  }, [d, step, loaded])

  // ---- validation ----
  const step1Valid = !!d.fullName?.trim() && !!d.heritageConfirm && !!d.falseInfoConfirm
  function step2Missing(): boolean {
    const need = ['gender', 'yearOfBirth', 'ukCity', 'indiaCity', 'emirate', 'maritalStatus', 'businessType', 'termsConfirm']
    for (const k of need) if (!d[k]?.trim()) return true
    if (!isEmail(d.email || '')) return true
    if (!isPhone(d.uaeMobile || '')) return true
    if (d.howHeard === 'bild_member' && (!d.referrerName?.trim() || !isPhone(d.referrerMobile || ''))) return true
    if (d.maritalStatus === 'married') {
      if (!d.hasChildren) return true
      if (d.hasChildren === 'yes' && !d.childrenAges?.trim()) return true
      if (!d.partnerName?.trim() || !isPhone(d.partnerMobile || '')) return true
    }
    if (d.businessType === 'business_owner' || d.businessType === 'professional') {
      for (const k of ['companyName', 'industry', 'jobTitle', 'linkedin', 'sponsorInterest', 'promoInterest']) if (!d[k]?.trim()) return true
    }
    return false
  }

  function submitStep1(e: React.FormEvent) {
    e.preventDefault(); setTried1(true)
    if (d.heritageConfirm === 'no' || d.falseInfoConfirm === 'no') { setIneligible(true); return }
    if (!step1Valid) return
    setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function submitStep2(e: React.FormEvent) {
    e.preventDefault(); setTried2(true)
    if (d.termsConfirm === 'no') { setIneligible(true); return }
    if (step2Missing()) {
      // Scroll to the first highlighted (invalid) field
      requestAnimationFrame(() => {
        const firstInvalid = step2Ref.current?.querySelector('.border-ruby-500')
        if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
        else step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    setStep(3); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function pay() {
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/join/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
      const json = await res.json()
      if (res.ok && json.url) {
        try { localStorage.removeItem(STORAGE_KEY) } catch {}
        window.location.href = json.url
      } else { setError(json.error || 'Could not start payment. Please try again or email connect@bild.ae'); setSubmitting(false) }
    } catch { setError('Could not start payment. Please check your connection and try again.'); setSubmitting(false) }
  }

  if (ineligible) {
    return (
      <div className="bg-cream border border-gold-200 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-ruby-500/10 rounded-full flex items-center justify-center mx-auto mb-5"><XCircle size={32} className="text-ruby-500" /></div>
        <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-3">Not eligible</h2>
        <p className="text-charcoal-600 max-w-md mx-auto">Thank you for your interest in BILD. Unfortunately, membership is open only to individuals who meet our eligibility criteria, so we&apos;re unable to accept your application at this time.</p>
        <p className="text-sm text-charcoal-500 mt-4">Believe this is a mistake? <a href="mailto:connect@bild.ae" className="text-gold-600 hover:underline">Contact us</a>.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Reassurance strip */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mb-6 text-xs text-charcoal-500">
        <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-gold-500" /> Takes about 2 minutes</span>
        <span className="inline-flex items-center gap-1.5"><Save size={13} className="text-gold-500" /> Progress saved automatically</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} className="text-gold-500" /> Secure payment by Stripe</span>
      </div>

      {/* Step indicator + progress bar */}
      <div className="flex items-start justify-center mb-3">
        {([[1, 'Eligibility'], [2, 'Your details'], [3, 'Payment']] as [number, string][]).map(([n, label], i) => (
          <div key={n} className="flex items-start">
            <div className="flex flex-col items-center w-24">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${step > n ? 'bg-gold-500 text-white' : step === n ? 'bg-gold-500 text-white ring-4 ring-gold-200' : 'bg-gold-100 text-charcoal-400'}`}>
                {step > n ? <Check size={16} /> : n}
              </div>
              <span className={`mt-2 text-xs text-center font-medium ${step >= n ? 'text-charcoal-700' : 'text-charcoal-400'}`}>{label}</span>
            </div>
            {i < 2 && <div className={`h-0.5 w-8 sm:w-14 mt-4 ${step > n ? 'bg-gold-500' : 'bg-gold-200'}`} />}
          </div>
        ))}
      </div>
      <div className="h-1 bg-gold-100 rounded-full mb-8 overflow-hidden max-w-md mx-auto">
        <div className="h-full bg-gold-500 transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={submitStep1} className="space-y-6">
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Eligibility</legend>
              <TextField label="Please enter your full name" value={d.fullName || ''} onChange={v => set('fullName', v)} required placeholder="Your full name" showError={tried1} />
              <div>
                <p className={labelCls}>I confirm that I am of British Indian heritage (Indian origin + born, raised, or previously settled in the UK) or married to someone who is, and meet the eligibility criteria. {req}</p>
                <p className="text-xs text-charcoal-400 mb-2">Please review our <Link href="/community-rules" className="text-gold-600 hover:underline">membership rules</Link> before answering.</p>
                <Toggle value={d.heritageConfirm || ''} onChange={v => set('heritageConfirm', v)} options={[['yes', 'Yes'], ['no', 'No']]} />
              </div>
              <div>
                <p className={labelCls}>I understand that providing false information will result in immediate removal. {req}</p>
                <Toggle value={d.falseInfoConfirm || ''} onChange={v => set('falseInfoConfirm', v)} options={[['yes', 'Yes'], ['no', 'No']]} />
              </div>
            </fieldset>
            <div className="sticky bottom-3 z-20 sm:static">
              <button type="submit" className="w-full bg-gold-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all inline-flex items-center justify-center gap-2 shadow-lg sm:shadow-none">Continue <ArrowRight size={18} /></button>
            </div>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <form ref={step2Ref} onSubmit={submitStep2} className="space-y-6">
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Your Details</legend>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Gender {req}</label>
                  <Toggle value={d.gender || ''} onChange={v => set('gender', v)} options={[['male', 'Male'], ['female', 'Female']]} />
                  {tried2 && !d.gender && <p className="text-xs text-ruby-500 mt-1">Please select.</p>}
                </div>
                <div>
                  <label className={labelCls}>Year of Birth {req}</label>
                  <select value={d.yearOfBirth || ''} onChange={e => set('yearOfBirth', e.target.value)} className={`${inputBase} ${tried2 && !d.yearOfBirth ? 'border-ruby-500' : d.yearOfBirth ? 'border-green-400' : 'border-gold-200'}`}>
                    <option value="">Select year</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <TextField label="Where in the UK are you from? (City/Town)" value={d.ukCity || ''} onChange={v => set('ukCity', v)} required showError={tried2} />
                <TextField label="City/Town of India you or your family are from" value={d.indiaCity || ''} onChange={v => set('indiaCity', v)} required showError={tried2} />
              </div>
              <TextField label="Religion" value={d.religion || ''} onChange={v => set('religion', v)} hint="Optional — helps us celebrate your cultural events" />
              <div className="grid sm:grid-cols-2 gap-5">
                <PhoneField label="UAE Mobile Number" value={d.uaeMobile || ''} onChange={v => set('uaeMobile', v)} required showError={tried2} />
                <TextField label="WhatsApp Number" value={d.whatsappNumber || ''} onChange={v => set('whatsappNumber', v)} hint="If different from above" />
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <TextField label="Email Address" value={d.email || ''} onChange={v => set('email', v)} required type="email" placeholder="you@example.com" validate={isEmail} showError={tried2} />
                <TextField label="Instagram" value={d.instagram || ''} onChange={v => set('instagram', v)} placeholder="@handle" hint="Optional" />
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Date you moved / will move to UAE {req}</label>
                  <input type="date" value={d.movedDate || ''} onChange={e => set('movedDate', e.target.value)} className={`${inputBase} ${tried2 && !d.movedDate ? 'border-ruby-500' : d.movedDate ? 'border-green-400' : 'border-gold-200'}`} />
                </div>
                <TextField label="Which UAE Emirate do you live in?" value={d.emirate || ''} onChange={v => set('emirate', v)} required placeholder="e.g. Dubai" showError={tried2} />
              </div>
              <div>
                <label className={labelCls}>How did you hear about us?</label>
                <Toggle value={d.howHeard || ''} onChange={v => set('howHeard', v)} options={[['instagram', 'Instagram'], ['facebook', 'Facebook'], ['bild_member', 'BILD member']]} />
              </div>
            </fieldset>

            {d.howHeard === 'bild_member' && (
              <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
                <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Referral Details</legend>
                <div className="grid sm:grid-cols-2 gap-5">
                  <TextField label="Name of BILD member who recommended you" value={d.referrerName || ''} onChange={v => set('referrerName', v)} required showError={tried2} />
                  <PhoneField label="Their mobile number" value={d.referrerMobile || ''} onChange={v => set('referrerMobile', v)} required showError={tried2} />
                </div>
              </fieldset>
            )}

            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Family Information</legend>
              <div>
                <label className={labelCls}>Marital Status {req}</label>
                <Toggle value={d.maritalStatus || ''} onChange={v => set('maritalStatus', v)} options={[['single', 'Single'], ['married', 'Married']]} />
                {tried2 && !d.maritalStatus && <p className="text-xs text-ruby-500 mt-1">Please select.</p>}
              </div>
              {d.maritalStatus === 'married' && (
                <>
                  <div>
                    <label className={labelCls}>Do you have children? {req}</label>
                    <Toggle value={d.hasChildren || ''} onChange={v => set('hasChildren', v)} options={[['yes', 'Yes'], ['no', 'No']]} />
                  </div>
                  {d.hasChildren === 'yes' && <TextField label="Your children's ages (helps us connect families)" value={d.childrenAges || ''} onChange={v => set('childrenAges', v)} required placeholder="e.g. 4, 7, 11" showError={tried2} />}
                  <div className="grid sm:grid-cols-2 gap-5">
                    <TextField label="Is your partner a BILD member? If so, their name" value={d.partnerName || ''} onChange={v => set('partnerName', v)} required placeholder="Name, or 'No'" showError={tried2} />
                    <PhoneField label="Partner's mobile number" value={d.partnerMobile || ''} onChange={v => set('partnerMobile', v)} required showError={tried2} />
                  </div>
                </>
              )}
            </fieldset>

            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Professional &amp; Business</legend>
              <div>
                <label className={labelCls}>Are you a British Indian business owner or professional in UAE? {req}</label>
                <Toggle value={d.businessType || ''} onChange={v => set('businessType', v)} options={[['business_owner', 'Business Owner'], ['professional', 'Professional'], ['neither', 'Neither']]} />
                {tried2 && !d.businessType && <p className="text-xs text-ruby-500 mt-1">Please select.</p>}
              </div>
              {(d.businessType === 'business_owner' || d.businessType === 'professional') && (
                <>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <TextField label="Company Name" value={d.companyName || ''} onChange={v => set('companyName', v)} required showError={tried2} />
                    <TextField label="Industry Vertical" value={d.industry || ''} onChange={v => set('industry', v)} required showError={tried2} />
                  </div>
                  <TextField label="Job Title" value={d.jobTitle || ''} onChange={v => set('jobTitle', v)} required showError={tried2} />
                  <TextField label="LinkedIn Profile" value={d.linkedin || ''} onChange={v => set('linkedin', v)} required placeholder="https://linkedin.com/in/…" showError={tried2} />
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div><label className={labelCls}>Interested in sponsoring future BILD events? {req}</label><Toggle value={d.sponsorInterest || ''} onChange={v => set('sponsorInterest', v)} options={[['yes', 'Yes'], ['no', 'No']]} /></div>
                    <div><label className={labelCls}>Interested in paid promotions/collaborations on BILD social? {req}</label><Toggle value={d.promoInterest || ''} onChange={v => set('promoInterest', v)} options={[['yes', 'Yes'], ['no', 'No']]} /></div>
                  </div>
                </>
              )}
            </fieldset>

            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Community Terms</legend>
              <p className="text-sm text-charcoal-600 mb-3">Do you confirm to abide by the BILD <Link href="/terms" className="text-gold-600 hover:underline">community terms</Link>, including UAE laws, and understand that providing false information will result in immediate removal? {req}</p>
              <Toggle value={d.termsConfirm || ''} onChange={v => set('termsConfirm', v)} options={[['yes', 'Yes'], ['no', 'No']]} />
            </fieldset>

            {tried2 && step2Missing() && <p className="text-sm text-ruby-500 text-center bg-ruby-500/10 border border-ruby-500/20 rounded-xl p-3">Please complete the highlighted fields above.</p>}

            <div className="flex gap-3 sticky bottom-3 z-20 sm:static">
              <button type="button" onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border-2 border-charcoal-300 bg-cream text-charcoal-700 font-semibold inline-flex items-center gap-2"><ArrowLeft size={18} /> Back</button>
              <button type="submit" className="flex-1 bg-gold-500 text-white py-3 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all inline-flex items-center justify-center gap-2 shadow-lg sm:shadow-none">Review &amp; Pay <ArrowRight size={18} /></button>
            </div>
          </form>
        )}

        {/* STEP 3 — Review + Pay */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-charcoal-800 rounded-2xl p-8 text-center">
              <p className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-2">Lifetime Membership</p>
              <p className="text-white font-display text-5xl font-bold">50 <span className="text-2xl">AED</span></p>
              <p className="text-gray-400 text-sm mt-2">One-off contribution. Secure payment via Stripe.</p>
            </div>

            {/* Review summary */}
            <div className="bg-cream border border-gold-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-charcoal-800 text-lg">Review your details</h3>
                <button onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-sm text-gold-600 hover:underline inline-flex items-center gap-1"><Pencil size={13} /> Edit</button>
              </div>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {([
                  ['Name', d.fullName], ['Email', d.email], ['Gender', d.gender], ['Year of birth', d.yearOfBirth],
                  ['UAE mobile', d.uaeMobile], ['Emirate', d.emirate], ['From (UK)', d.ukCity], ['Family (India)', d.indiaCity],
                  ['Marital status', d.maritalStatus], ['Business', d.businessType],
                ] as [string, string?][]).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-gold-100 py-1">
                    <dt className="text-charcoal-500">{k}</dt>
                    <dd className="text-charcoal-800 font-medium text-right capitalize">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {error && <p className="text-ruby-500 text-sm text-center bg-ruby-500/10 border border-ruby-500/20 rounded-xl p-3">{error}</p>}

            <div className="flex gap-3 sticky bottom-3 z-20 sm:static">
              <button type="button" onClick={() => setStep(2)} className="px-5 py-3 rounded-xl border-2 border-charcoal-300 bg-cream text-charcoal-700 font-semibold inline-flex items-center gap-2"><ArrowLeft size={18} /> Back</button>
              <button onClick={pay} disabled={submitting} className="flex-1 bg-gold-500 text-white py-3 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2 shadow-lg sm:shadow-none">
                <Lock size={16} /> {submitting ? 'Redirecting to payment…' : 'Pay 50 AED & Join'}
              </button>
            </div>
            <p className="flex items-center justify-center gap-1.5 text-xs text-charcoal-400"><ShieldCheck size={13} className="text-gold-500" /> Secured by Stripe. We never see your card details.</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
