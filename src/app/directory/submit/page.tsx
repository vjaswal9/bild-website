'use client'

import { useState, useRef } from 'react'
import { CheckCircle, ArrowLeft, FileText, X } from 'lucide-react'
import Link from 'next/link'
import PageHero from '@/components/ui/PageHero'
import { supabase } from '@/lib/supabase'

const CATEGORIES = [
  'Financial Services', 'Beauty', 'Residency Services', 'Marketing',
  'Consultancy & Advisory', 'Recruitment', 'Motors', 'Health & Wellbeing',
  'Property', 'Jewellery', 'Legal', 'Food & Catering', 'Technology',
  'Education & Tutoring', 'Photography & Videography', 'Events & Entertainment',
  'Retail & Fashion', 'Professional Services', 'Arts & Entertainment', 'Other',
]

export default function SubmitBusinessPage() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const form = e.currentTarget
    const fd = new FormData(form)

    // Upload business license PDF to Supabase Storage
    let licenseUrl: string | null = null
    if (licenseFile) {
      const fileName = `${Date.now()}-${licenseFile.name.replace(/\s+/g, '-')}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('business-licenses')
        .upload(fileName, licenseFile, { contentType: 'application/pdf' })

      if (uploadError) {
        setError('Failed to upload business license. Please try again.')
        setSubmitting(false)
        return
      }
      licenseUrl = uploadData.path
    }

    const payload = {
      business_name: fd.get('business_name') as string,
      category: fd.get('category') as string,
      description: fd.get('description') as string,
      location: fd.get('location') as string,
      owner_name: fd.get('owner_name') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      website: (fd.get('website') as string) || null,
      instagram: (fd.get('instagram') as string) || null,
      logo_url: (fd.get('logo_url') as string) || null,
      years_in_business: (fd.get('years_in_business') as string) || null,
      bild_offer: (fd.get('bild_offer') as string) || null,
      extra_info: (fd.get('extra_info') as string) || null,
      license_url: licenseUrl,
      status: 'pending',
    }

    const { error: sbError } = await supabase
      .from('business_submissions')
      .insert([payload])

    if (sbError) {
      setError('Something went wrong. Please try again or email us at connect@bild.ae')
    } else {
      setSubmitted(true)
    }
    setSubmitting(false)
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
          <p className="text-charcoal-600 mb-2">
            Thank you for submitting your business. Our team will review your listing and you will hear back within 48 hours.
          </p>
          <p className="text-charcoal-400 text-sm mb-8">Once approved, your business will appear in the BILD directory.</p>
          <Link href="/directory" className="inline-block bg-gold-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gold-600 transition-colors">
            Back to Directory
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHero title="List Your Business" subtitle="Join the BILD Business Directory, free for all members" />
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
                <textarea name="description" required rows={4} placeholder="Tell us what your business does and what makes it special..."
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

            {/* Logo */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Logo &amp; Branding</legend>
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Logo URL</label>
                <input name="logo_url" type="url" placeholder="https://link-to-your-logo.com/logo.png"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                <p className="text-xs text-charcoal-400 mt-1">Paste a direct link to your logo image.</p>
              </div>
            </fieldset>

            {/* Business License */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-4">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Business License <span className="text-ruby-500">*</span></legend>
              <p className="text-sm text-charcoal-500">
                Please upload a copy of your valid UAE trade licence or business license. This is required for verification and will only be seen by the BILD admin team. It will never be shared publicly.
              </p>

              {!licenseFile ? (
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gold-300 rounded-xl cursor-pointer bg-white hover:bg-gold-50 transition-colors">
                  <FileText size={32} className="text-gold-400 mb-2" />
                  <span className="text-sm font-medium text-charcoal-600">Click to upload your business license</span>
                  <span className="text-xs text-charcoal-400 mt-1">PDF only, max 10MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    required
                    className="hidden"
                    onChange={e => setLicenseFile(e.target.files?.[0] || null)}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-3 bg-gold-50 border border-gold-200 rounded-xl px-4 py-3">
                  <FileText size={24} className="text-gold-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-800 truncate">{licenseFile.name}</p>
                    <p className="text-xs text-charcoal-400">{(licenseFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setLicenseFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="text-charcoal-400 hover:text-red-500 transition-colors"
                    aria-label="Remove file"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </fieldset>

            {/* Extra */}
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
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Anything else you&apos;d like to add?</label>
                <textarea name="extra_info" rows={3} placeholder="Awards, certifications, languages spoken, notable clients, etc."
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400 resize-none" />
              </div>

              <div className="flex items-start gap-3">
                <input id="member_confirm" name="member_confirm" type="checkbox" required
                  className="mt-1 h-4 w-4 accent-gold-500" />
                <label htmlFor="member_confirm" className="text-sm text-charcoal-600">
                  I confirm that I am a current BILD member, the information provided is accurate, and the business license uploaded is valid. <span className="text-ruby-500">*</span>
                </label>
              </div>
            </fieldset>

            {error && <p className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gold-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Uploading & Submitting...' : 'Submit My Business'}
            </button>

            <p className="text-xs text-center text-charcoal-400">
              Your submission will be reviewed within 48 hours. By submitting, you agree to our{' '}
              <Link href="/community-rules" className="text-gold-600 hover:underline">community rules</Link>.
            </p>
          </form>
        </div>
      </div>
    </>
  )
}
