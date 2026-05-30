'use client'

import { useState } from 'react'
import { CheckCircle, Upload, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import PageHero from '@/components/ui/PageHero'
import { SITE_CONFIG } from '@/data/config'

const CATEGORIES = [
  'Financial Services',
  'Beauty',
  'Residency Services',
  'Marketing',
  'Consultancy & Advisory',
  'Recruitment',
  'Motors',
  'Health & Wellbeing',
  'Property',
  'Jewellery',
  'Legal',
  'Food & Catering',
  'Technology',
  'Education & Tutoring',
  'Professional Services',
  'Arts & Entertainment',
  'Retail & Fashion',
  'Photography & Videography',
  'Events & Entertainment',
  'Other',
]

export default function SubmitBusinessPage() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const form = e.currentTarget
    const data = new FormData(form)

    try {
      const res = await fetch(SITE_CONFIG.businessFormEndpoint, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Please try again or email us directly.')
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <>
        <PageHero title="List Your Business" subtitle="Join the BILD Business Directory" />
        <div className="py-20 max-w-xl mx-auto px-4 text-center">
          <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-gold-500" />
          </div>
          <h2 className="font-display text-3xl font-bold text-charcoal-800 mb-4">Submission received!</h2>
          <p className="text-charcoal-600 mb-8">
            Thank you for submitting your business. We will review your listing and add it to the directory within 48 hours.
          </p>
          <Link
            href="/directory"
            className="inline-block bg-gold-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gold-600 transition-colors"
          >
            Back to Directory
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHero title="List Your Business" subtitle="Join the BILD Business Directory — free for all members" />
      <div className="py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/directory" className="inline-flex items-center gap-2 text-charcoal-600 hover:text-gold-600 mb-8 text-sm font-medium">
            <ArrowLeft size={16} /> Back to Directory
          </Link>

          <div className="bg-gold-50 border border-gold-200 rounded-2xl p-4 mb-8 text-sm text-charcoal-600">
            <strong className="text-charcoal-800">BILD members only.</strong> The Business Directory is exclusively for current BILD members. If you are not yet a member, please{' '}
            <Link href="/join" className="text-gold-600 hover:underline font-medium">join BILD first</Link>.
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Business Info */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Business Information</legend>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Business Name <span className="text-ruby-500">*</span></label>
                <input name="business_name" required type="text" placeholder="e.g. Spice Route Catering"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Category <span className="text-ruby-500">*</span></label>
                <select name="category" required
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400">
                  <option value="">Select a category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Business Description <span className="text-ruby-500">*</span></label>
                <textarea name="description" required rows={4} placeholder="Tell us what your business does and what makes it special (max 200 words)..."
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Location / Area <span className="text-ruby-500">*</span></label>
                <input name="location" required type="text" placeholder="e.g. Dubai Marina, Abu Dhabi, Online"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
              </div>
            </fieldset>

            {/* Contact Info */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Contact Details</legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Your Name <span className="text-ruby-500">*</span></label>
                  <input name="owner_name" required type="text" placeholder="Full name"
                    className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Contact Number <span className="text-ruby-500">*</span></label>
                  <input name="phone" required type="tel" placeholder="+971 50 123 4567"
                    className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Business Email <span className="text-ruby-500">*</span></label>
                <input name="email" required type="email" placeholder="hello@yourbusiness.com"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Website</label>
                <input name="website" type="url" placeholder="https://www.yourbusiness.com"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Instagram Handle</label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-gold-100 border border-r-0 border-gold-200 rounded-l-xl text-charcoal-500 text-sm">@</span>
                  <input name="instagram" type="text" placeholder="yourbusiness"
                    className="flex-1 px-4 py-2.5 border border-gold-200 rounded-r-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                </div>
              </div>
            </fieldset>

            {/* Logo upload */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Logo &amp; Branding</legend>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Business Logo</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gold-300 rounded-xl cursor-pointer bg-white hover:bg-gold-50 transition-colors">
                  <Upload size={24} className="text-gold-400 mb-2" />
                  <span className="text-sm text-charcoal-500">Click to upload logo</span>
                  <span className="text-xs text-charcoal-400 mt-1">PNG, JPG or SVG (max 2MB)</span>
                  <input name="logo" type="file" accept="image/*" className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Logo URL (alternative)</label>
                <input name="logo_url" type="url" placeholder="https://link-to-your-logo.com/logo.png"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                <p className="text-xs text-charcoal-400 mt-1">If you have a hosted logo, paste the URL here instead.</p>
              </div>
            </fieldset>

            {/* Extra info */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Additional Information</legend>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Years in Business</label>
                <input name="years_in_business" type="number" min="0" placeholder="e.g. 3"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Special Offer for BILD Members</label>
                <input name="bild_offer" type="text" placeholder="e.g. 10% discount for BILD members"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                <p className="text-xs text-charcoal-400 mt-1">Optional — any exclusive deal you want to offer fellow BILD members.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Anything else you&apos;d like to add?</label>
                <textarea name="extra_info" rows={3} placeholder="Awards, certifications, notable clients, languages spoken, etc."
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400 resize-none" />
              </div>

              <div className="flex items-start gap-3">
                <input id="member_confirm" name="member_confirm" type="checkbox" required
                  className="mt-1 h-4 w-4 accent-gold-500" />
                <label htmlFor="member_confirm" className="text-sm text-charcoal-600">
                  I confirm that I am a current BILD member and the information provided is accurate. <span className="text-ruby-500">*</span>
                </label>
              </div>
            </fieldset>

            {error && (
              <p className="text-ruby-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gold-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit My Business'}
            </button>

            <p className="text-xs text-center text-charcoal-400">
              Your submission will be reviewed by the BILD team within 48 hours. By submitting, you agree to our{' '}
              <Link href="/community-rules" className="text-gold-600 hover:underline">community rules</Link>.
            </p>
          </form>
        </div>
      </div>
    </>
  )
}
