'use client'

import { useState } from 'react'
import { uploadViaSignedUrl } from '@/lib/upload-client'
import { Loader2, Save, Plus, X, Eye, FileText, Upload, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/compress-image'
import { btnPrimary } from '@/lib/ui'

const inputBase = 'w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400'
const labelCls = 'block text-sm font-semibold text-charcoal-700 mb-1.5'

const BROCHURE_MAX_MB = 10

export default function FeaturedContentForm({
  token, initialBio, initialGallery, initialVideoUrl, initialOffers, viewCount,
  initialBrochureUrl = '', initialBrochureName = '',
}: {
  token: string; initialBio: string; initialGallery: string[]; initialVideoUrl: string; initialOffers: string[]; viewCount: number
  initialBrochureUrl?: string; initialBrochureName?: string
}) {
  const [bio, setBio] = useState(initialBio)
  const [gallery, setGallery] = useState<string[]>(initialGallery)
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl)
  const [offers, setOffers] = useState<string[]>(initialOffers)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [brochureUrl, setBrochureUrl] = useState(initialBrochureUrl)
  const [brochureName, setBrochureName] = useState(initialBrochureName)
  const [brochureBusy, setBrochureBusy] = useState<'' | 'uploading' | 'removing'>('')
  const [brochureError, setBrochureError] = useState('')
  const [brochureSaved, setBrochureSaved] = useState('')

  // Saves on its own, separately from "Save Changes", so a brochure is never
  // lost because the rest of the form was not saved afterwards.
  async function uploadBrochure(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setBrochureError('')
    setBrochureSaved('')
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setBrochureError('Please choose a PDF file.')
      return
    }
    if (file.size > BROCHURE_MAX_MB * 1024 * 1024) {
      setBrochureError(`That PDF is over ${BROCHURE_MAX_MB} MB. Please compress it and try again.`)
      return
    }
    setBrochureBusy('uploading')
    try {
      const startRes = await fetch('/api/business/featured-brochure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'start', fileName: file.name, size: file.size }),
      })
      const start = await startRes.json().catch(() => ({}))
      if (!startRes.ok) throw new Error(start.error || 'Could not start the upload.')

      const { error: upErr } = await supabase.storage
        .from('business-logos')
        .uploadToSignedUrl(start.path, start.uploadToken, file, { contentType: 'application/pdf' })
      if (upErr) throw new Error('The upload failed. Please check your connection and try again.')

      const confirmRes = await fetch('/api/business/featured-brochure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'confirm', path: start.path, fileName: file.name }),
      })
      const done = await confirmRes.json().catch(() => ({}))
      if (!confirmRes.ok) throw new Error(done.error || 'Could not save your brochure.')

      setBrochureUrl(done.url)
      setBrochureName(done.name)
      setBrochureSaved('Brochure uploaded. It is now on your profile.')
    } catch (e) {
      setBrochureError(e instanceof Error ? e.message : 'Could not upload your brochure.')
    }
    setBrochureBusy('')
  }

  async function removeBrochure() {
    if (!confirm('Remove your brochure from your profile?')) return
    setBrochureError('')
    setBrochureSaved('')
    setBrochureBusy('removing')
    try {
      const res = await fetch('/api/business/featured-brochure', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not remove your brochure.')
      setBrochureUrl('')
      setBrochureName('')
      setBrochureSaved('Brochure removed.')
    } catch (e) {
      setBrochureError(e instanceof Error ? e.message : 'Could not remove your brochure.')
    }
    setBrochureBusy('')
  }

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setError('')
    const remaining = 6 - gallery.length
    if (remaining <= 0) { setError('Maximum 6 photos.'); return }
    setUploading(true)
    try {
      const toUpload = Array.from(files).slice(0, remaining)
      const urls: string[] = []
      for (const file of toUpload) {
        const compressed = await compressImage(file, 1200)
        const up = await uploadViaSignedUrl({ kind: 'featured-photo', file: compressed, token })
        if (up.publicUrl) urls.push(up.publicUrl)
      }
      setGallery(prev => [...prev, ...urls])
    } catch {
      setError('Failed to upload one or more photos. Please try again.')
    }
    setUploading(false)
  }

  function removePhoto(url: string) {
    setGallery(prev => prev.filter(u => u !== url))
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/business/featured-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          bio: bio.trim(),
          gallery_urls: gallery,
          video_url: videoUrl.trim(),
          offers: offers.map(o => o.trim()).filter(Boolean),
        }),
      })
      const json = await res.json()
      if (res.ok) setSaved(true)
      else setError(json.error || 'Could not save. Please try again.')
    } catch {
      setError('Could not save. Please check your connection and try again.')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-cream border border-gold-200 rounded-2xl p-6 flex items-center gap-3">
        <Eye size={18} className="text-gold-500" />
        <p className="text-sm text-charcoal-600"><strong>{viewCount}</strong> profile view{viewCount === 1 ? '' : 's'} so far</p>
      </div>

      <div className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
        <div>
          <label className={labelCls}>Extended Bio</label>
          <p className="text-sm text-charcoal-500 mb-2">
            <strong className="text-charcoal-700">What this is:</strong> a longer description shown on your profile page underneath your
            short directory description. Room to explain your services properly.
          </p>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={5} placeholder="Tell your story in more depth..." className={`${inputBase} resize-none`} />
        </div>

        <div>
          <label className={labelCls}>Photo Gallery ({gallery.length}/6)</label>
          <p className="text-sm text-charcoal-500 mb-2">
            <strong className="text-charcoal-700">What this is:</strong> a set of photos shown as a grid partway down your profile page,
            below your description. Use them to show your products, your work, your premises or your team. Only Featured listings have this.
          </p>
          <p className="text-xs text-charcoal-500 bg-cream border border-gold-200 rounded-lg px-3 py-2 mb-3">
            <strong className="text-charcoal-700">Recommended size:</strong> square, <strong>800 x 800 pixels</strong> or larger. JPG or PNG.
            Photos are shown as squares, so keep the subject centred. Up to 6 images.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {gallery.map(url => (
              <div key={url} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                <button type="button" onClick={() => removePhoto(url)} className="absolute top-1 right-1 bg-charcoal-900/70 text-white rounded-full p-1">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          {gallery.length < 6 && (
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-gold-300 rounded-lg text-sm text-charcoal-700 cursor-pointer hover:bg-gold-50">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {uploading ? 'Uploading...' : 'Add photos'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => addPhotos(e.target.files)} disabled={uploading} />
            </label>
          )}
        </div>

        <div>
          <label className={labelCls}>Video Link</label>
          <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="YouTube or Instagram Reel link" className={inputBase} />
          <p className="text-xs text-charcoal-500 mt-1.5">
            <strong className="text-charcoal-700">What this is:</strong> one video embedded in your profile page, under your photos.
            Paste the full link, for example https://youtube.com/watch?v=... or an Instagram Reel URL. Nothing is uploaded - the video stays on YouTube or Instagram.
          </p>
        </div>

        <div>
          <label className={labelCls}>Brochure (PDF)</label>
          <p className="text-sm text-charcoal-500 mb-2">
            <strong className="text-charcoal-700">What this is:</strong> a PDF visitors can download from your profile page, such as a
            brochure, menu, price list or company profile. Only Featured listings have this.
          </p>
          <p className="text-xs text-charcoal-500 bg-cream border border-gold-200 rounded-lg px-3 py-2 mb-3">
            <strong className="text-charcoal-700">Requirements:</strong> one PDF, up to <strong>{BROCHURE_MAX_MB} MB</strong>. It saves as soon as it
            uploads, so there is no need to press Save Changes for this. Uploading a new PDF replaces the old one.
          </p>

          {brochureUrl ? (
            <div className="flex items-center gap-3 bg-white border border-gold-200 rounded-xl px-4 py-3 mb-3">
              <FileText size={20} className="text-gold-600 shrink-0" />
              <a href={brochureUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-charcoal-700 hover:text-gold-700 hover:underline truncate flex-1 min-w-0">
                {brochureName || 'Your brochure'}
              </a>
              <button
                type="button"
                onClick={removeBrochure}
                disabled={!!brochureBusy}
                className="text-charcoal-400 hover:text-ruby-500 disabled:opacity-50 shrink-0"
                title="Remove brochure"
              >
                {brochureBusy === 'removing' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </div>
          ) : null}

          <label className={`inline-flex items-center gap-2 px-4 py-2 border border-gold-300 rounded-lg text-sm text-charcoal-700 hover:bg-gold-50 ${brochureBusy ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}>
            {brochureBusy === 'uploading' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {brochureBusy === 'uploading' ? 'Uploading...' : brochureUrl ? 'Replace brochure' : 'Upload brochure'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={!!brochureBusy}
              onChange={e => { uploadBrochure(e.target.files); e.target.value = '' }}
            />
          </label>
          {brochureError && <p className="text-ruby-500 text-sm mt-2">{brochureError}</p>}
          {brochureSaved && <p className="text-green-600 text-sm mt-2">{brochureSaved}</p>}
        </div>

        <div>
          <label className={labelCls}>BILD Member Offers</label>
          <div className="space-y-2">
            {offers.map((offer, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text" value={offer}
                  onChange={e => setOffers(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                  placeholder="e.g. 10% off catering"
                  className={inputBase}
                />
                {offers.length > 1 && (
                  <button type="button" onClick={() => setOffers(prev => prev.filter((_, j) => j !== i))} className="px-3 text-charcoal-400 hover:text-ruby-500">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {offers.length < 10 && (
            <button type="button" onClick={() => setOffers(prev => [...prev, ''])} className="mt-2 inline-flex items-center gap-1.5 text-sm text-gold-600 hover:underline">
              <Plus size={14} /> Add another offer
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-ruby-500 text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm">Saved!</p>}

      <button onClick={save} disabled={saving || uploading} className={`${btnPrimary} px-6 py-3`}>
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
