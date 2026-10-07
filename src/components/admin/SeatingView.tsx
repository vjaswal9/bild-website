'use client'

import { useEffect, useState } from 'react'
import SeatingPanel from '@/components/admin/SeatingPanel'
import FloorPlan from '@/components/admin/FloorPlan'
import DraftSeating from '@/components/admin/DraftSeating'

// Wraps the existing seating panel and adds a List | Floor plan switch. The
// list view is the unchanged SeatingPanel and is always the default. The switch
// only appears when the floor plan is actually available for the event (the
// database update has been run, and the event has table seating set up), so an
// event, or a site, that has not opted in sees exactly what it saw before.
export default function SeatingView({ eventId }: { eventId: string }) {
  const [available, setAvailable] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [view, setView] = useState<'list' | 'plan' | 'draft'>('list')

  useEffect(() => {
    let live = true
    fetch(`/api/admin/events/seating-layout?eventId=${eventId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setAvailable(!!d?.available) })
      .catch(() => {})
    fetch(`/api/admin/events/seating-draft?eventId=${eventId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setDraftReady(!!d?.available) })
      .catch(() => {})
    return () => { live = false }
  }, [eventId])

  const tab = (on: boolean) => `px-3 py-1.5 text-xs ${on ? 'bg-gold-500 text-white' : 'text-gray-300 hover:bg-charcoal-700'}`

  return (
    <div>
      {available && (
        <div className="px-6 pt-4">
          <div className="inline-flex border border-charcoal-600 rounded-lg overflow-hidden" role="group" aria-label="Seating view">
            <button type="button" className={tab(view === 'list')} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
            <button type="button" className={tab(view === 'plan')} aria-pressed={view === 'plan'} onClick={() => setView('plan')}>Floor plan</button>
            {draftReady && <button type="button" className={tab(view === 'draft')} aria-pressed={view === 'draft'} onClick={() => setView('draft')}>Draft seating</button>}
          </div>
        </div>
      )}
      {view === 'plan' && available ? <FloorPlan eventId={eventId} /> : view === 'draft' && draftReady ? <DraftSeating eventId={eventId} /> : <SeatingPanel eventId={eventId} />}
    </div>
  )
}
