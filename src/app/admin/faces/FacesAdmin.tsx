'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/admin/AdminNav'
import { FacesReel } from '@/lib/faces-reels'
import { FaInstagram } from 'react-icons/fa'
import { Trash2, Loader2, Plus, EyeOff, Eye, Pin, PinOff } from 'lucide-react'

const inputClass = 'w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500'

function ReelForm({ reel, onDone }: { reel?: FacesReel; onDone: () => void }) {
  const [name, setName] = useState(reel?.name ?? '')
  const [url, setUrl] = useState(reel?.url ?? '')
  const [caption, setCaption] = useState(reel?.caption ?? '')
  const [active, setActive] = useState(reel?.active ?? true)
  const [pinned, setPinned] = useState(reel?.pinned ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!name.trim() || !url.trim()) { setError('Name and Instagram URL are required.'); return }
    setSaving(true)
    const res = await fetch('/api/admin/faces', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reel?.id, name, url, caption, active, pinned }),
    })
    setSaving(false)
    if (res.ok) { onDone() } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Could not save. Please try again.')
    }
  }

  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-5 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Patel Family" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Instagram post / reel URL</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/..." className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Caption (optional)</label>
        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="A short line of context" className={inputClass} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="inline-flex items-center gap-2 text-sm text-gray-200">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="h-4 w-4 accent-gold-500" />
          Published (visible on the Faces of BILD page)
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-200">
          <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="h-4 w-4 accent-gold-500" />
          Pinned (always shows first)
        </label>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : null} {reel ? 'Save changes' : 'Add reel'}
        </button>
        <button onClick={onDone} className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-gray-300 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

function ReelRow({ reel }: { reel: FacesReel }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pinning, setPinning] = useState(false)

  async function remove() {
    if (!confirm(`Remove "${reel.name}"?`)) return
    setDeleting(true)
    const res = await fetch('/api/admin/faces', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reel.id }),
    })
    if (res.ok) router.refresh()
    setDeleting(false)
  }

  async function togglePin() {
    setPinning(true)
    const res = await fetch('/api/admin/faces', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reel.id, name: reel.name, url: reel.url, caption: reel.caption, active: reel.active, pinned: !reel.pinned }),
    })
    if (res.ok) router.refresh()
    setPinning(false)
  }

  if (editing) {
    return <ReelForm reel={reel} onDone={() => { setEditing(false); router.refresh() }} />
  }

  return (
    <div className={`flex items-center gap-4 bg-charcoal-800 border rounded-xl p-4 ${reel.pinned ? 'border-gold-500' : 'border-charcoal-700'}`}>
      <div className="w-9 h-9 rounded-full bg-charcoal-700 flex items-center justify-center text-gray-400 shrink-0">
        <FaInstagram size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{reel.name}</p>
        <a href={reel.url} target="_blank" rel="noopener noreferrer" className="text-gold-400 text-xs hover:underline break-all">{reel.url}</a>
        {reel.caption && <p className="text-gray-500 text-xs mt-1">{reel.caption}</p>}
      </div>
      {reel.pinned && (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full shrink-0 bg-gold-500/10 text-gold-400">
          <Pin size={12} /> Pinned
        </span>
      )}
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full shrink-0 ${reel.active ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
        {reel.active ? <Eye size={12} /> : <EyeOff size={12} />} {reel.active ? 'Published' : 'Hidden'}
      </span>
      <button onClick={togglePin} disabled={pinning} className="text-gray-400 hover:text-gold-400 shrink-0" aria-label={reel.pinned ? 'Unpin' : 'Pin to top'} title={reel.pinned ? 'Unpin' : 'Pin to top'}>
        {pinning ? <Loader2 size={16} className="animate-spin" /> : reel.pinned ? <PinOff size={16} /> : <Pin size={16} />}
      </button>
      <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-white text-sm font-medium shrink-0">Edit</button>
      <button onClick={remove} disabled={deleting} className="text-gray-400 hover:text-red-400 shrink-0" aria-label="Delete">
        {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </button>
    </div>
  )
}

export default function FacesAdmin({ reels }: { reels: FacesReel[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Faces of BILD" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-white">Faces of BILD reels</h1>
          {!adding && (
            <button onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              <Plus size={16} /> Add reel
            </button>
          )}
        </div>

        {adding && <ReelForm onDone={() => { setAdding(false); router.refresh() }} />}

        {reels.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No reels yet. Add one to get started.</p>
        ) : (
          <div className="space-y-3">
            {reels.map(reel => <ReelRow key={reel.id} reel={reel} />)}
          </div>
        )}
      </div>
    </div>
  )
}
