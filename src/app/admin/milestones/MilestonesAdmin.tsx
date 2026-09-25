'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Save, Trash2, Loader2, ChevronUp, ChevronDown, Eye, EyeOff, Pencil, X, ExternalLink,
} from 'lucide-react'
import type { Milestone } from '@/lib/milestones'

type Draft = { id?: string; yearLabel: string; title: string; body: string; published: boolean }

const BLANK: Draft = { yearLabel: '', title: '', body: '', published: true }

export default function MilestonesAdmin({ milestones }: { milestones: Milestone[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [working, setWorking] = useState<string | null>(null)

  async function save() {
    if (!editing) return
    setError('')
    if (!editing.yearLabel.trim()) return setError('Please give a year or range, for example 2019 or 2020 - 2022.')
    if (!editing.title.trim()) return setError('Please give the entry a title.')
    setBusy(true)
    const res = await fetch('/api/admin/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d.error || 'Could not save.')
    setEditing(null)
    router.refresh()
  }

  async function remove(m: Milestone) {
    if (!confirm(`Delete the ${m.year_label} entry "${m.title}"? This removes it from the About page.`)) return
    setWorking(m.id)
    await fetch(`/api/admin/milestones?id=${m.id}`, { method: 'DELETE' })
    setWorking(null)
    router.refresh()
  }

  async function togglePublished(m: Milestone) {
    setWorking(m.id)
    await fetch('/api/admin/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: m.id, yearLabel: m.year_label, title: m.title, body: m.body,
        sortOrder: m.sort_order, published: !m.published,
      }),
    })
    setWorking(null)
    router.refresh()
  }

  async function setAll(published: boolean) {
    setWorking('all')
    await fetch('/api/admin/milestones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published }),
    })
    setWorking(null)
    router.refresh()
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...milestones]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setWorking(milestones[index].id)
    await fetch('/api/admin/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map(m => m.id) }),
    })
    setWorking(null)
    router.refresh()
  }

  const anyVisible = milestones.some(m => m.published)

  const input = 'w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Milestones</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-xl">
            The timeline on the About page. Changes appear on the site straight away.{' '}
            <a
              href="/about"
              target="_blank"
              rel="noreferrer"
              className="text-gold-400 hover:underline inline-flex items-center gap-1"
            >
              View the About page <ExternalLink size={12} />
            </a>
          </p>
        </div>
        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setAll(!anyVisible)}
              disabled={working === 'all' || milestones.length === 0}
              className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              title={anyVisible ? 'Take the whole timeline off the About page' : 'Put the timeline back on the About page'}
            >
              {working === 'all'
                ? <Loader2 size={16} className="animate-spin" />
                : anyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              {anyVisible ? 'Hide timeline' : 'Show timeline'}
            </button>
            <button
              onClick={() => { setEditing({ ...BLANK }); setError('') }}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus size={16} /> Add a milestone
            </button>
          </div>
        )}
      </div>

      {milestones.length > 0 && !anyVisible && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6">
          <p className="text-amber-200 font-semibold text-sm">The timeline is hidden</p>
          <p className="text-amber-200/70 text-sm mt-1 leading-relaxed">
            Nothing is lost. The About page simply leaves the section out entirely until you press Show timeline.
          </p>
        </div>
      )}

      {editing && (
        <div className="bg-charcoal-800 border border-gold-500/40 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold">{editing.id ? 'Edit milestone' : 'New milestone'}</p>
            <button onClick={() => { setEditing(null); setError('') }} className="text-gray-500 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Year or range</span>
              <input
                value={editing.yearLabel}
                onChange={e => setEditing({ ...editing, yearLabel: e.target.value })}
                placeholder="2019, or 2020 - 2022"
                className={input}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-gray-400 text-xs block mb-1">Title</span>
              <input
                value={editing.title}
                onChange={e => setEditing({ ...editing, title: e.target.value })}
                placeholder="BILD begins in Dubai"
                className={input}
              />
            </label>
          </div>

          <label className="block mb-3">
            <span className="text-gray-400 text-xs block mb-1">What happened</span>
            <textarea
              value={editing.body}
              onChange={e => setEditing({ ...editing, body: e.target.value })}
              rows={4}
              placeholder="A sentence or two. Specifics land best: names, venues, numbers."
              className={`${input} resize-y leading-relaxed`}
            />
          </label>

          <label className="flex items-center gap-2 mb-4 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={editing.published}
              onChange={e => setEditing({ ...editing, published: e.target.checked })}
              className="accent-gold-500 w-4 h-4"
            />
            Show this entry on the About page
          </label>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
            </button>
            <button
              onClick={() => { setEditing(null); setError('') }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {milestones.length === 0 ? (
        <p className="text-gray-500 text-sm py-10 text-center">
          No milestones yet. Add the first one and it will appear on the About page.
        </p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m, i) => (
            <div
              key={m.id}
              className={`bg-charcoal-800 border border-charcoal-700 rounded-xl p-4 flex items-start gap-4 ${
                m.published ? '' : 'opacity-55'
              }`}
            >
              {/* Order controls: the timeline reads top to bottom, so up and
                  down is the whole interaction. */}
              <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || working === m.id}
                  className="text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500"
                  title="Move up"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === milestones.length - 1 || working === m.id}
                  className="text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500"
                  title="Move down"
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest">{m.year_label}</p>
                <h3 className="text-white font-semibold mt-0.5">{m.title}</h3>
                <p className="text-gray-400 text-sm mt-1 leading-relaxed">{m.body}</p>
                {!m.published && <p className="text-gray-600 text-xs mt-2">Hidden from the About page</p>}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => togglePublished(m)}
                  disabled={working === m.id}
                  className="text-gray-500 hover:text-white p-1.5"
                  title={m.published ? 'Hide from the About page' : 'Show on the About page'}
                >
                  {working === m.id ? <Loader2 size={15} className="animate-spin" /> : m.published ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button
                  onClick={() => {
                    setError('')
                    setEditing({ id: m.id, yearLabel: m.year_label, title: m.title, body: m.body, published: m.published })
                  }}
                  className="text-gray-500 hover:text-white p-1.5"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(m)}
                  disabled={working === m.id}
                  className="text-gray-600 hover:text-red-400 p-1.5"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
