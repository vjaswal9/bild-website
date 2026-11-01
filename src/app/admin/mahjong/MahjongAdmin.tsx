'use client'

import { useMemo, useState } from 'react'
import { Download, MessageCircle, Trash2 } from 'lucide-react'
import type { MahjongRow } from '@/lib/mahjong-admin'
import { mahjongLabel, MAHJONG_EXPERIENCE_OPTIONS, MAHJONG_MEMBER_OPTIONS } from '@/lib/mahjong-interest'

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' })

// Counts of one answer across everyone, biggest first.
function tally(values: string[]) {
  const m = new Map<string, number>()
  for (const v of values) m.set(v, (m.get(v) || 0) + 1)
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
}

export default function MahjongAdmin({ initial, problem }: { initial: MahjongRow[]; problem: string }) {
  const [rows, setRows] = useState(initial)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  const areas = useMemo(() => tally(rows.map(r => r.area)), [rows])
  const times = useMemo(() => tally(rows.flatMap(r => r.availability || [])), [rows])
  const experience = useMemo(() => tally(rows.map(r => mahjongLabel(MAHJONG_EXPERIENCE_OPTIONS, r.experience))), [rows])
  const shown = rows.filter(r => !q.trim() || `${r.full_name} ${r.whatsapp} ${r.area}`.toLowerCase().includes(q.trim().toLowerCase()))

  async function remove(r: MahjongRow) {
    if (!window.confirm(`Remove ${r.full_name} from the Mahjong list? This cannot be undone.`)) return
    setError('')
    const res = await fetch('/api/admin/mahjong', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id }),
    })
    if (!res.ok) { setError('Could not remove this person. Please try again.'); return }
    setRows(prev => prev.filter(x => x.id !== r.id))
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-gray-200">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Mahjong interest</h1>
          <p className="text-gray-400 text-sm mt-1">
            {rows.length} {rows.length === 1 ? 'person has' : 'people have'} registered on bild.ae/mahjong. Nobody has paid anything.
          </p>
        </div>
        <a href="/api/admin/mahjong" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gold-500 text-white text-sm font-semibold hover:bg-gold-600">
          <Download size={16} /> Download spreadsheet
        </a>
      </div>

      {problem && <p role="alert" className="mb-4 rounded-lg bg-ruby-500/20 border border-ruby-500/40 px-4 py-3 text-sm text-ruby-200">{problem}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-ruby-500/20 border border-ruby-500/40 px-4 py-3 text-sm text-ruby-200">{error}</p>}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[['By area', areas], ['By experience', experience], ['Times that suit', times]].map(([title, list]) => (
            <div key={title as string} className="rounded-xl bg-charcoal-800 border border-charcoal-700 p-4">
              <h2 className="text-sm font-semibold text-white mb-2">{title as string}</h2>
              <ul className="space-y-1 text-sm">
                {(list as [string, number][]).map(([label, n]) => (
                  <li key={label} className="flex justify-between gap-3"><span className="text-gray-300">{label}</span><span className="text-gold-400 font-semibold tabular-nums">{n}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <input
        type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, number or area"
        aria-label="Search the Mahjong list"
        className="w-full sm:max-w-sm mb-4 px-4 py-2.5 rounded-lg bg-charcoal-800 border border-charcoal-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-400"
      />

      {shown.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">{rows.length === 0 ? 'Nobody has registered yet.' : 'No one matches that search.'}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map(r => (
            <li key={r.id} className="rounded-xl bg-charcoal-800 border border-charcoal-700 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{r.full_name}</p>
                  <p className="text-sm text-gray-400">Registered {when(r.created_at)} &middot; BILD member: {mahjongLabel(MAHJONG_MEMBER_OPTIONS, r.member_status)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={`https://wa.me/${r.whatsapp_digits}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                    <MessageCircle size={15} /> {r.whatsapp}
                  </a>
                  <button type="button" onClick={() => remove(r)} aria-label={`Remove ${r.full_name}`} title="Remove this person"
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-charcoal-700">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                <div><dt className="text-gray-500">Area</dt><dd className="text-gray-200">{r.area}</dd></div>
                <div><dt className="text-gray-500">Experience</dt><dd className="text-gray-200">{mahjongLabel(MAHJONG_EXPERIENCE_OPTIONS, r.experience)}</dd></div>
                <div><dt className="text-gray-500">Times</dt><dd className="text-gray-200">{(r.availability || []).join(', ')}</dd></div>
              </dl>
              {r.notes && <p className="mt-3 text-sm text-gray-300 whitespace-pre-wrap break-words">{r.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
