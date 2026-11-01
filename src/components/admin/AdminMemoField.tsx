'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, StickyNote } from 'lucide-react'
import { ADMIN_MEMO_MAX } from '@/lib/admin-memo'

// A one-line private note on a booking or a waiting-list entry. It saves when
// the admin leaves the box or presses Enter, so there is no button to forget.
// Escape puts back what was there. Admins only: the value comes from, and
// goes to, an admin route.
export default function AdminMemoField({ kind, id, value }: {
  kind: 'booking' | 'waitlist'
  id: string
  value?: string | null
}) {
  const saved = value ?? ''
  const [text, setText] = useState(saved)
  const [last, setLast] = useState(saved)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The list reloads after other actions: follow a changed saved value. This
  // must depend on the saved value alone. Tying it to focus would put the old
  // text back the moment the box is left, wiping a note that failed to save
  // and, on a list that does not reload, hiding one that did.
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!focusedRef.current) { setText(saved); setLast(saved) }
  }, [saved])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function save() {
    const next = text.trim()
    if (next === last.trim()) { setText(last); return }
    setState('saving'); setError('')
    const res = await fetch('/api/admin/events/memo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, memo: next }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    if (!res || !res.ok) {
      setState('error')
      setError(d.error || 'Could not save the note.')
      return
    }
    const stored = (d.memo as string | null) ?? ''
    setText(stored); setLast(stored)
    setState('saved')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2000)
  }

  const nearLimit = text.length >= ADMIN_MEMO_MAX - 8

  return (
    <div className="mt-2">
      <label className="flex items-center gap-2">
        <StickyNote size={13} className="shrink-0 text-gold-400/80" aria-hidden="true" />
        <span className="sr-only">Private admin note</span>
        <input
          type="text"
          value={text}
          maxLength={ADMIN_MEMO_MAX}
          onChange={e => { setText(e.target.value); if (state !== 'idle') setState('idle') }}
          onFocus={() => { focusedRef.current = true; setFocused(true) }}
          onBlur={() => { focusedRef.current = false; setFocused(false); void save() }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
            if (e.key === 'Escape') { setText(last); e.currentTarget.blur() }
          }}
          placeholder="Private note (admins only)"
          autoComplete="off"
          className="min-w-0 flex-1 max-w-sm bg-charcoal-800 border border-charcoal-600 focus:border-gold-500 focus:outline-none rounded-md px-2.5 py-1 text-xs text-white placeholder-gray-600"
        />
        <span className="shrink-0 text-xs tabular-nums w-14">
          {state === 'saving' && <Loader2 size={12} className="animate-spin text-gray-400" aria-label="Saving" />}
          {state === 'saved' && <span className="inline-flex items-center gap-1 text-green-400"><Check size={12} /> Saved</span>}
          {state !== 'saving' && state !== 'saved' && (focused || nearLimit) && (
            <span className={text.length >= ADMIN_MEMO_MAX ? 'text-amber-400' : 'text-gray-500'}>{text.length}/{ADMIN_MEMO_MAX}</span>
          )}
        </span>
      </label>
      {state === 'error' && <p className="text-red-400 text-xs mt-1 pl-5" role="alert">{error}</p>}
    </div>
  )
}
