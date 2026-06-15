'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldCheck, XCircle, ArrowRight, ArrowLeft, Lock, Check } from 'lucide-react'

const inputCls =
  'w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400'
const labelCls = 'block text-sm font-semibold text-charcoal-700 mb-1.5'
const req = <span className="text-ruby-500">*</span>

type Data = Record<string, string>

export default function JoinForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [ineligible, setIneligible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [d, setD] = useState<Data>({})

  const set = (k: string, v: string) => setD(prev => ({ ...prev, [k]: v }))

  // ---- Step 1: eligibility gate ----
  function submitStep1(e: React.FormEvent) {
    e.preventDefault()
    if (d.heritageConfirm !== 'yes' || d.falseInfoConfirm !== 'yes') {
      setIneligible(true)
      return
    }
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ---- Step 2: details ----
  function submitStep2(e: React.FormEvent) {
    e.preventDefault()
    if (d.termsConfirm === 'no') { setIneligible(true); return }
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ---- Step 3: pay ----
  async function pay() {
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/join/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      })
      const json = await res.json()
      if (res.ok && json.url) {
        window.location.href = json.url
      } else {
        setError(json.error || 'Could not start payment. Please try again or email connect@bild.ae')
        setSubmitting(false)
      }
    } catch {
      setError('Could not start payment. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  if (ineligible) {
    return (
      <div className="bg-cream border border-gold-200 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-ruby-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle size={32} className="text-ruby-500" />
        </div>
        <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-3">Not eligible</h2>
        <p className="text-charcoal-600 max-w-md mx-auto">
          Thank you for your interest in BILD. Unfortunately, membership is open only to individuals who meet our
          eligibility criteria, so we&apos;re unable to accept your application at this time.
        </p>
        <p className="text-sm text-charcoal-500 mt-4">
          Believe this is a mistake? <a href="mailto:connect@bild.ae" className="text-gold-600 hover:underline">Contact us</a>.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Step indicator with labels */}
      <div className="flex items-start justify-center mb-10">
        {([[1, 'Eligibility'], [2, 'Your details'], [3, 'Payment']] as [number, string][]).map(([n, label], i) => (
          <div key={n} className="flex items-start">
            <div className="flex flex-col items-center w-24">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step > n ? 'bg-gold-500 text-white' : step === n ? 'bg-gold-500 text-white ring-4 ring-gold-200' : 'bg-gold-100 text-charcoal-400'
              }`}>
                {step > n ? <Check size={16} /> : n}
              </div>
              <span className={`mt-2 text-xs text-center font-medium ${step >= n ? 'text-charcoal-700' : 'text-charcoal-400'}`}>{label}</span>
            </div>
            {i < 2 && <div className={`h-0.5 w-8 sm:w-14 mt-4 ${step > n ? 'bg-gold-500' : 'bg-gold-200'}`} />}
          </div>
        ))}
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      {/* STEP 1 — Eligibility */}
      {step === 1 && (
        <form onSubmit={submitStep1} className="space-y-6">
          <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
            <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Eligibility</legend>
            <div>
              <label className={labelCls}>Please enter your full name {req}</label>
              <input required type="text" value={d.fullName || ''} onChange={e => set('fullName', e.target.value)} className={inputCls} placeholder="Your full name" />
            </div>
            <div>
              <p className={labelCls}>
                I confirm that I am of British Indian heritage (Indian origin + born, raised, or previously settled in the UK)
                or married to someone who is, and meet the eligibility criteria. {req}
              </p>
              <p className="text-xs text-charcoal-400 mb-2">Please review our <Link href="/community-rules" className="text-gold-600 hover:underline">membership rules</Link> before answering.</p>
              <div className="flex gap-3">
                {['yes', 'no'].map(v => (
                  <button type="button" key={v} onClick={() => set('heritageConfirm', v)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize border ${d.heritageConfirm === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <p className={labelCls}>I understand that providing false information will result in immediate removal. {req}</p>
              <div className="flex gap-3">
                {['yes', 'no'].map(v => (
                  <button type="button" key={v} onClick={() => set('falseInfoConfirm', v)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize border ${d.falseInfoConfirm === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{v}</button>
                ))}
              </div>
            </div>
          </fieldset>
          <button type="submit" disabled={!d.fullName || !d.heritageConfirm || !d.falseInfoConfirm}
            className="w-full bg-gold-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2">
            Continue <ArrowRight size={18} />
          </button>
        </form>
      )}

      {/* STEP 2 — Details */}
      {step === 2 && (
        <form onSubmit={submitStep2} className="space-y-6">
          <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
            <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Your Details</legend>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Gender {req}</label>
                <div className="flex gap-3">
                  {['male', 'female'].map(v => (
                    <button type="button" key={v} onClick={() => set('gender', v)}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold capitalize border ${d.gender === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{v}</button>
                  ))}
                </div>
              </div>
              <div><label className={labelCls}>Year of Birth {req}</label><input required type="number" min="1920" max="2010" value={d.yearOfBirth || ''} onChange={e => set('yearOfBirth', e.target.value)} className={inputCls} placeholder="e.g. 1990" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className={labelCls}>Where in the UK are you from? (City/Town) {req}</label><input required value={d.ukCity || ''} onChange={e => set('ukCity', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>City/Town of India you or your family are from {req}</label><input required value={d.indiaCity || ''} onChange={e => set('indiaCity', e.target.value)} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Religion <span className="text-charcoal-400 font-normal">(optional, helps us celebrate your cultural events)</span></label><input value={d.religion || ''} onChange={e => set('religion', e.target.value)} className={inputCls} /></div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className={labelCls}>UAE Mobile Number {req}</label><input required type="tel" value={d.uaeMobile || ''} onChange={e => set('uaeMobile', e.target.value)} className={inputCls} placeholder="+971 5X XXX XXXX" /></div>
              <div><label className={labelCls}>WhatsApp Number <span className="text-charcoal-400 font-normal">(if different)</span></label><input type="tel" value={d.whatsappNumber || ''} onChange={e => set('whatsappNumber', e.target.value)} className={inputCls} /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className={labelCls}>Email Address {req}</label><input required type="email" value={d.email || ''} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="you@example.com" /></div>
              <div><label className={labelCls}>Instagram <span className="text-charcoal-400 font-normal">(optional)</span></label><input value={d.instagram || ''} onChange={e => set('instagram', e.target.value)} className={inputCls} placeholder="@handle" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className={labelCls}>Date you moved / will move to UAE {req}</label><input required type="date" value={d.movedDate || ''} onChange={e => set('movedDate', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Which UAE Emirate do you live in? {req}</label><input required value={d.emirate || ''} onChange={e => set('emirate', e.target.value)} className={inputCls} placeholder="e.g. Dubai" /></div>
            </div>
            <div>
              <label className={labelCls}>How did you hear about us?</label>
              <div className="flex flex-wrap gap-3">
                {[['instagram', 'Instagram'], ['facebook', 'Facebook'], ['bild_member', 'BILD member']].map(([v, lbl]) => (
                  <button type="button" key={v} onClick={() => set('howHeard', v)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border ${d.howHeard === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{lbl}</button>
                ))}
              </div>
            </div>
          </fieldset>

          {/* Referral — only if BILD member */}
          {d.howHeard === 'bild_member' && (
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Referral Details</legend>
              <div className="grid sm:grid-cols-2 gap-5">
                <div><label className={labelCls}>Name of BILD member who recommended you {req}</label><input required value={d.referrerName || ''} onChange={e => set('referrerName', e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Their mobile number {req}</label><input required type="tel" value={d.referrerMobile || ''} onChange={e => set('referrerMobile', e.target.value)} className={inputCls} /></div>
              </div>
            </fieldset>
          )}

          {/* Family */}
          <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
            <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Family Information</legend>
            <div>
              <label className={labelCls}>Marital Status {req}</label>
              <div className="flex gap-3">
                {['single', 'married'].map(v => (
                  <button type="button" key={v} onClick={() => set('maritalStatus', v)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize border ${d.maritalStatus === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{v}</button>
                ))}
              </div>
            </div>
            {d.maritalStatus === 'married' && (
              <>
                <div>
                  <label className={labelCls}>Do you have children? {req}</label>
                  <div className="flex gap-3">
                    {['yes', 'no'].map(v => (
                      <button type="button" key={v} onClick={() => set('hasChildren', v)}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize border ${d.hasChildren === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{v}</button>
                    ))}
                  </div>
                </div>
                {d.hasChildren === 'yes' && (
                  <div><label className={labelCls}>Your children&apos;s ages (helps us connect families) {req}</label><input required value={d.childrenAges || ''} onChange={e => set('childrenAges', e.target.value)} className={inputCls} placeholder="e.g. 4, 7, 11" /></div>
                )}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div><label className={labelCls}>Is your partner a BILD member? If so, their name {req}</label><input required value={d.partnerName || ''} onChange={e => set('partnerName', e.target.value)} className={inputCls} placeholder="Name, or 'No'" /></div>
                  <div><label className={labelCls}>Partner&apos;s mobile number {req}</label><input required type="tel" value={d.partnerMobile || ''} onChange={e => set('partnerMobile', e.target.value)} className={inputCls} /></div>
                </div>
              </>
            )}
          </fieldset>

          {/* Professional & Business */}
          <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
            <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Professional &amp; Business</legend>
            <div>
              <label className={labelCls}>Are you a British Indian business owner or professional in UAE? {req}</label>
              <div className="flex flex-wrap gap-3">
                {[['business_owner', 'Business Owner'], ['professional', 'Professional'], ['neither', 'Neither']].map(([v, lbl]) => (
                  <button type="button" key={v} onClick={() => set('businessType', v)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border ${d.businessType === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{lbl}</button>
                ))}
              </div>
            </div>
            {(d.businessType === 'business_owner' || d.businessType === 'professional') && (
              <>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div><label className={labelCls}>Company Name {req}</label><input required value={d.companyName || ''} onChange={e => set('companyName', e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Industry Vertical {req}</label><input required value={d.industry || ''} onChange={e => set('industry', e.target.value)} className={inputCls} /></div>
                </div>
                <div><label className={labelCls}>Job Title {req}</label><input required value={d.jobTitle || ''} onChange={e => set('jobTitle', e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>LinkedIn Profile {req}</label><input required value={d.linkedin || ''} onChange={e => set('linkedin', e.target.value)} className={inputCls} placeholder="https://linkedin.com/in/…" /></div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Interested in sponsoring future BILD events? {req}</label>
                    <div className="flex gap-3">{['yes', 'no'].map(v => (<button type="button" key={v} onClick={() => set('sponsorInterest', v)} className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize border ${d.sponsorInterest === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{v}</button>))}</div>
                  </div>
                  <div>
                    <label className={labelCls}>Interested in paid promotions/collaborations on BILD social? {req}</label>
                    <div className="flex gap-3">{['yes', 'no'].map(v => (<button type="button" key={v} onClick={() => set('promoInterest', v)} className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize border ${d.promoInterest === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{v}</button>))}</div>
                  </div>
                </div>
              </>
            )}
          </fieldset>

          {/* Terms */}
          <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6">
            <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Community Terms</legend>
            <p className="text-sm text-charcoal-600 mb-3">
              Do you confirm to abide by the BILD <Link href="/terms" className="text-gold-600 hover:underline">community terms</Link>, including UAE laws, and understand that providing false information will result in immediate removal? {req}
            </p>
            <div className="flex gap-3">
              {['yes', 'no'].map(v => (
                <button type="button" key={v} onClick={() => set('termsConfirm', v)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize border ${d.termsConfirm === v ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200'}`}>{v}</button>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border-2 border-charcoal-300 text-charcoal-700 font-semibold inline-flex items-center gap-2"><ArrowLeft size={18} /> Back</button>
            <button type="submit" disabled={!d.gender || !d.maritalStatus || !d.businessType || !d.termsConfirm}
              className="flex-1 bg-gold-500 text-white py-3 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2">
              Review &amp; Pay <ArrowRight size={18} />
            </button>
          </div>
        </form>
      )}

      {/* STEP 3 — Pay */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-charcoal-800 rounded-2xl p-8 text-center">
            <p className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-2">Lifetime Membership</p>
            <p className="text-white font-display text-5xl font-bold">50 <span className="text-2xl">AED</span></p>
            <p className="text-gray-400 text-sm mt-2">One-off contribution. Secure payment via Stripe.</p>
          </div>
          <div className="bg-cream border border-gold-200 rounded-2xl p-6 text-sm text-charcoal-600">
            <p><strong className="text-charcoal-800">{d.fullName}</strong> &middot; {d.email}</p>
            <p className="mt-1">You&apos;ll be taken to Stripe to pay securely. After payment you&apos;ll get your welcome and your WhatsApp group invite link.</p>
          </div>
          {error && <p className="text-ruby-500 text-sm text-center bg-ruby-500/10 border border-ruby-500/20 rounded-xl p-3">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="px-5 py-3 rounded-xl border-2 border-charcoal-300 text-charcoal-700 font-semibold inline-flex items-center gap-2"><ArrowLeft size={18} /> Back</button>
            <button onClick={pay} disabled={submitting}
              className="flex-1 bg-gold-500 text-white py-3 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2">
              <Lock size={16} /> {submitting ? 'Redirecting to payment…' : 'Pay 50 AED & Join'}
            </button>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-charcoal-400">
            <ShieldCheck size={13} className="text-gold-500" /> Secured by Stripe. We never see your card details.
          </p>
        </div>
      )}
      </motion.div>
    </div>
  )
}
