'use client'

import { useState } from 'react'
import { uploadViaSignedUrl } from '@/lib/upload-client'
import { useRouter } from 'next/navigation'
import { BusinessSubmission } from '@/lib/supabase'
import { compressImage } from '@/lib/compress-image'
import { getImageDimensions, squareWarning } from '@/lib/image-dimensions'
import { Save, X, Upload, Loader2, ImagePlus } from 'lucide-react'

const FIELDS: {
  key: keyof BusinessSubmission
  label: string
  type?: 'textarea' | 'date' | 'select' | 'checkbox'
  // Only for selects that need their own choices; business_country falls
  // back to the default UAE/UK pair.
  options?: { value: string; label: string }[]
}[] = [
  { key: 'business_name', label: 'Business name' },
  { key: 'owner_name', label: 'Owner name' },
  { key: 'category', label: 'Category' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'location', label: 'Location' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'instagram', label: 'Instagram (handle only)' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'google_maps_url', label: 'Google review link' },
  { key: 'google_place_id', label: 'Google Place ID (auto-resolved, or set manually)' },
  { key: 'established_year', label: 'Established year' },
  { key: 'bild_member_since', label: 'BILD member since (year)' },
  { key: 'years_in_business', label: 'Years in business' },
  { key: 'logo_url', label: 'Logo URL' },
  { key: 'banner_url', label: 'Banner image URL (wide hero at top of profile)' },
  { key: 'banner_bg', label: 'Banner background', type: 'select',
    options: [
      { value: '', label: 'Auto (white if the image is transparent)' },
      { value: 'light', label: 'Always white - for dark or colourful logos' },
      { value: 'dark', label: 'Always dark - for pale or white logos' },
    ] },
  { key: 'instagram_post_url', label: 'Instagram post link to embed (a single post, not the profile)' },
  { key: 'business_country', label: 'Registered in', type: 'select' },
  { key: 'document_expiry_date', label: 'Document expiry date', type: 'date' },
  { key: 'slug', label: 'URL slug' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'bild_offer', label: 'BILD member offer', type: 'textarea' },
  { key: 'extra_info', label: 'Extra info', type: 'textarea' },
  { key: 'listing_fee_exempt', label: 'Comp this listing - never charge or remind', type: 'checkbox' },
  { key: 'listing_paid_until', label: 'Listing paid until (manual override)', type: 'date' },
]

export default function EditBusinessForm({
  sub,
  onCancel,
}: {
  sub: BusinessSubmission
  onCancel: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    FIELDS.forEach(f => {
      const v = sub[f.key]
      init[f.key as string] = v == null ? '' : String(v)
    })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoWarning, setLogoWarning] = useState('')
  const [uploadingBanner, setUploadingBanner] = useState(false)

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function replaceLogo(file: File | null) {
    if (!file) return
    setLogoWarning('')
    setUploadingLogo(true)
    setError('')
    try {
      const { width, height } = await getImageDimensions(file)
      const w = squareWarning(width, height)
      if (w) setLogoWarning(w)
    } catch { /* ignore - not critical */ }

    try {
      const logo = await compressImage(file, 800)
      const up = await uploadViaSignedUrl({ kind: 'business-logo', file: logo })
      if (!up.publicUrl) {
        setError('Failed to upload logo. Please try a different image.')
        return
      }
      set('logo_url', up.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo. Please try a different image.')
    } finally {
      setUploadingLogo(false)
    }
  }

  // Banner is a wide hero, so it is compressed to a larger max width than the
  // logo and skips the square-image warning.
  async function replaceBanner(file: File | null) {
    if (!file) return
    setUploadingBanner(true)
    setError('')
    try {
      const banner = await compressImage(file, 1600)
      const up = await uploadViaSignedUrl({ kind: 'business-banner', file: banner })
      if (!up.publicUrl) {
        setError('Failed to upload banner. Please try a different image.')
        return
      }
      set('banner_url', up.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload banner. Please try a different image.')
    } finally {
      setUploadingBanner(false)
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/business/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sub.id, ...form }),
    })
    if (res.ok) {
      router.refresh()
      onCancel()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="p-6 bg-charcoal-900 border-t border-charcoal-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(f => (
          <div key={f.key as string} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
            {f.type !== 'checkbox' && <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{f.label}</label>}
            {f.type === 'checkbox' ? (
              <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={form[f.key as string] === 'true'}
                  onChange={e => set(f.key as string, String(e.target.checked))}
                  className="h-4 w-4 accent-gold-500"
                />
                {f.label}
              </label>
            ) : f.type === 'textarea' ? (
              <textarea
                value={form[f.key as string]}
                onChange={e => set(f.key as string, e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
              />
            ) : f.type === 'select' ? (
              <select
                value={form[f.key as string]}
                onChange={e => set(f.key as string, e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                {(f.options ?? [{ value: 'UAE', label: 'UAE' }, { value: 'UK', label: 'UK' }]).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === 'date' ? 'date' : 'text'}
                value={form[f.key as string]}
                onChange={e => set(f.key as string, e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            )}
          </div>
        ))}
      </div>

      {/* Replace logo image */}
      <div className="mt-4 p-4 bg-charcoal-800 border border-charcoal-700 rounded-xl">
        <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">Replace logo image</label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg border border-charcoal-600 bg-charcoal-700 flex items-center justify-center overflow-hidden shrink-0">
            {form.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={form.logo_url} alt="Current logo" className="w-full h-full object-cover" />
              : <ImagePlus size={22} className="text-gray-500" />}
          </div>
          <label className={`inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${uploadingLogo ? 'opacity-60 pointer-events-none' : ''}`}>
            {uploadingLogo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploadingLogo ? 'Uploading...' : 'Upload new logo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploadingLogo}
              onChange={e => replaceLogo(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        {logoWarning && <p className="text-xs text-amber-400 mt-2">{logoWarning}</p>}
        <p className="text-xs text-gray-500 mt-2">Uploads to storage and fills in the Logo URL field above. Square, 500 x 500 pixels or larger works best.</p>
      </div>

      <div className="mt-4 border-t border-charcoal-700 pt-4">
        <p className="text-sm font-semibold text-gray-300 mb-2">Banner image</p>
        <div className="flex items-center gap-4">
          <div className="w-32 h-12 rounded-lg border border-charcoal-600 bg-charcoal-700 flex items-center justify-center overflow-hidden shrink-0">
            {form.banner_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={form.banner_url} alt="Current banner" className="w-full h-full object-cover" />
              : <ImagePlus size={20} className="text-gray-500" />}
          </div>
          <label className={`inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${uploadingBanner ? 'opacity-60 pointer-events-none' : ''}`}>
            {uploadingBanner ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploadingBanner ? 'Uploading...' : 'Upload banner'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploadingBanner}
              onChange={e => replaceBanner(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-2">Wide hero image across the top of the profile. 1600 x 400 pixels (4:1) works best - keep faces and text near the middle, as the edges are trimmed. Leave empty and the profile simply starts at the logo.</p>
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Save size={16} /> {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-gray-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <X size={16} /> Cancel
        </button>
      </div>
    </div>
  )
}
