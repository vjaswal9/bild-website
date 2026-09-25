import { CalendarPlus, Apple } from 'lucide-react'
import { googleCalendarUrl } from '@/lib/calendar'
import type { EventRow } from '@/lib/events'

// Two plain links, no client-side JS: Google opens a pre-filled event, and the
// .ics route covers Apple Calendar, Outlook, and everything else.
export default function AddToCalendar({ event }: { event: EventRow }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'
  const googleUrl = googleCalendarUrl({
    title: event.title,
    startIso: event.event_date,
    endIso: event.end_date,
    description: event.description,
    venue: event.venue,
    location: event.location,
    url: `${base}/events/${event.slug}`,
  })

  const linkClass =
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-charcoal-700 hover:border-gold-400 hover:text-gold-600 transition-colors'

  return (
    <div className="mb-8">
      <p className="text-xs text-charcoal-500 font-medium uppercase tracking-wide mb-2">Add to your calendar</p>
      <div className="flex flex-wrap gap-3">
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <CalendarPlus size={16} className="text-gold-500" /> Google Calendar
        </a>
        <a href={`/events/${event.slug}/calendar.ics`} className={linkClass}>
          <Apple size={16} className="text-gold-500" /> Apple / Outlook
        </a>
      </div>
    </div>
  )
}
