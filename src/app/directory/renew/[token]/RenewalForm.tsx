'use client'

import { useState, useRef } from 'react'
import { uploadViaSignedUrl } from '@/lib/upload-client'
import { CheckCircle, FileText, X } from 'lucide-react'

export default function RenewalForm({ token, businessName, country }: { token: string; businessName: string; country: 'UAE' | 'UK' }) {
  const documentLabel = country === 'UAE' ? 'licence' : 'registration document'
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!licenseFile) {
      setError(`Please upload your renewed ${documentLabel}.`)
      return
    }
    setSubmitting(true)
    setError('')

    let uploadedPath: string
    try {
      const up = await uploadViaSignedUrl({
        kind: 'business-licence',
        file: licenseFile,
        contentType: 'application/pdf',
        // Proves this renewal link is genuine, so the upload is allowed.
        token,
      })
      uploadedPath = up.path
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to upload your ${documentLabel}. Please try again.`)
      setSubmitting(false)
      return
    }

    const res = await fetch('/api/business/renew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        document_url: uploadedPath,
        document_expiry_date: expiryDate,
      }),
    })

    if (res.ok) {
      setSubmitted(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Could not submit your renewal. Please try again.')
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-gold-500" />
        </div>
        <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-4">Renewal submitted!</h2>
        <p className="text-charcoal-600">
          Thanks - we&rsquo;ve received your renewed {documentLabel} for <strong>{businessName}</strong>. Our team will
          review it shortly and confirm once it&rsquo;s approved.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-4">
        <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Renewed Document</legend>
        <p className="text-sm text-charcoal-500">
          {country === 'UAE'
            ? 'Upload your new UAE trade licence, and confirm its new expiry date.'
            : 'Upload your new UK business registration evidence, and confirm its new expiry date.'}
        </p>

        {!licenseFile ? (
          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gold-300 rounded-xl cursor-pointer bg-white hover:bg-gold-50 transition-colors">
            <FileText size={32} className="text-gold-400 mb-2" />
            <span className="text-sm font-medium text-charcoal-600">Click to upload your renewed {documentLabel}</span>
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

        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
            New document expiry date <span className="text-ruby-500">*</span>
          </label>
          <input
            type="date"
            required
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
            className="w-full px-3 py-2 border border-gold-200 rounded-lg bg-white text-charcoal-800 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
        </div>
      </fieldset>

      {error && <p className="text-ruby-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-gold-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit renewal'}
      </button>
    </form>
  )
}
