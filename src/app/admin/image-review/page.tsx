'use client'

import { useCallback, useEffect, useState } from 'react'
import { ScanEye, Loader2, CheckCircle2 } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'

type Region = { x0: number; y0: number; x1: number; y1: number; kind: 'bottle' | 'glass'; label: string }
type Flagged = { id: string; url: string; source: string; ref_label: string | null; regions: Region[]; reason: string | null }
type Counts = Record<string, number>

const SOURCE_LABEL: Record<string, string> = {
  event_gallery: 'Event photo',
  business_logo: 'Directory logo',
  business_banner: 'Directory banner',
  business_featured: 'Directory featured photo',
}

export default function ImageReviewPage() {
  const [flagged, setFlagged] = useState<Flagged[] | null>(null)
  const [counts, setCounts] = useState<Counts>({})
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/image-check')
    if (!res.ok) { setError('Could not load the photo check.'); return }
    const d = await res.json()
    setFlagged(d.flagged)
    setCounts(d.counts)
    setConfigured(d.configured)
  }, [])

  useEffect(() => { load() }, [load])

  // Works through the whole backlog in small batches so no single request runs
  // long enough to time out.
  async function checkNow() {
    setChecking(true); setError(''); setNote('')
    let scanned = 0
    try {
      for (let round = 0; round < 40; round++) {
        const res = await fetch('/api/admin/image-check/scan', { method: 'POST' })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) { setError(d.error || 'The photo check failed.'); break }
        scanned += d.scanned
        setNote(`Checked ${scanned} photo${scanned === 1 ? '' : 's'}${d.remaining ? `, ${d.remaining} to go...` : '.'}`)
        await load()
        if (d.remaining === 0 || d.scanned === 0) break
      }
    } finally { setChecking(false) }
  }

  const waiting = counts.pending || 0

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Photo check" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
              <ScanEye size={24} className="text-gold-400" /> Photo check
            </h1>
            <p className="text-gray-400 text-sm mt-1 max-w-2xl">
              New event photos and directory images are looked at automatically for bottles, labels and drinks
              shelves. Anything found is listed here. Nothing is blurred until you choose to.
            </p>
          </div>
          <button
            onClick={checkNow}
            disabled={checking || !configured}
            className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {checking ? <><Loader2 size={16} className="animate-spin" /> Checking...</> : waiting ? `Check ${waiting} new photo${waiting === 1 ? '' : 's'} now` : 'Check for new photos'}
          </button>
        </div>

        {!configured && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200 mb-6">
            The check is not switched on yet. Add <span className="font-mono">ANTHROPIC_API_KEY</span> in Vercel
            (Settings, Environment Variables), then redeploy.
          </div>
        )}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {note && <p className="text-gray-300 text-sm mb-4">{note}</p>}

        <p className="text-gray-500 text-xs mb-6">
          {counts.clear || 0} clear, {counts.blurred || 0} blurred, {counts.kept || 0} kept as they are
          {counts.error ? `, ${counts.error} could not be checked` : ''}.
        </p>

        {flagged === null ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : flagged.length === 0 ? (
          <div className="rounded-2xl border border-charcoal-700 bg-charcoal-800 p-8 text-center">
            <CheckCircle2 size={32} className="text-green-400 mx-auto mb-3" />
            <p className="text-white font-semibold">Nothing waiting for review</p>
            <p className="text-gray-400 text-sm mt-1">Photos that look like they show alcohol will appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {flagged.map(f => (
              <ReviewCard key={f.id} item={f} onDone={() => { setFlagged(prev => (prev || []).filter(x => x.id !== f.id)); load() }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewCard({ item, onDone }: { item: Flagged; onDone: () => void }) {
  // Bottles and shelves start ticked. Glasses are routine at a social event,
  // so they are offered but start unticked.
  const [ticked, setTicked] = useState<boolean[]>(() => item.regions.map(r => r.kind === 'bottle'))
  const [busy, setBusy] = useState<'' | 'blur' | 'keep'>('')
  const [error, setError] = useState('')

  async function resolve(action: 'blur' | 'keep') {
    setBusy(action); setError('')
    const res = await fetch('/api/admin/image-check/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        action,
        regionIndexes: ticked.flatMap((t, i) => (t ? [i] : [])),
      }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) onDone()
    else { setError(d.error || 'Something went wrong.'); setBusy('') }
  }

  const anyTicked = ticked.some(Boolean)

  return (
    <div className="rounded-2xl border border-charcoal-700 bg-charcoal-800 overflow-hidden">
      <div className="grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* The areas that will be blurred are shown blurred, live. */}
        <div className="relative bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt="Photo to review" className="block w-full h-auto" />
          {item.regions.map((r, i) => (
            <div
              key={i}
              className={`absolute rounded-sm ${ticked[i] ? 'backdrop-blur-xl' : 'outline outline-2 outline-dashed outline-amber-400/80'}`}
              style={{
                left: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`,
                width: `${(r.x1 - r.x0) * 100}%`, height: `${(r.y1 - r.y0) * 100}%`,
              }}
            />
          ))}
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{SOURCE_LABEL[item.source] || 'Photo'}</p>
            <p className="text-white font-semibold">{item.ref_label || 'Untitled'}</p>
            {item.reason && <p className="text-gray-400 text-sm mt-1">{item.reason}</p>}
          </div>

          <div>
            <p className="text-sm text-gray-300 mb-2">Areas to blur</p>
            <div className="space-y-2">
              {item.regions.map((r, i) => (
                <label key={i} htmlFor={`${item.id}-${i}`} className="flex items-start gap-2 text-sm text-gray-200 cursor-pointer">
                  <input
                    id={`${item.id}-${i}`}
                    type="checkbox"
                    checked={ticked[i]}
                    onChange={e => setTicked(prev => prev.map((t, j) => (j === i ? e.target.checked : t)))}
                    className="mt-0.5"
                  />
                  <span>
                    {r.label}
                    {r.kind === 'glass' && <span className="text-gray-500"> (a drink, optional)</span>}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              The boxes are a best guess. Untick any that cover the wrong thing, such as a face.
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 flex-wrap mt-auto">
            <button
              onClick={() => resolve('blur')}
              disabled={!!busy || !anyTicked}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {busy === 'blur' ? <><Loader2 size={16} className="animate-spin" /> Blurring...</> : 'Blur ticked areas'}
            </button>
            <button
              onClick={() => resolve('keep')}
              disabled={!!busy}
              className="inline-flex items-center gap-2 border border-charcoal-600 text-gray-200 hover:bg-charcoal-700 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {busy === 'keep' ? 'Saving...' : 'Keep as it is'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
