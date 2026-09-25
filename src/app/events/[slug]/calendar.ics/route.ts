import { NextResponse } from 'next/server'
import { getEventBySlug } from '@/lib/events-server'
import { buildIcs } from '@/lib/calendar'

export const dynamic = 'force-dynamic'

// Serves the event as a downloadable .ics file. This is a real URL ending in
// .ics rather than a browser-generated blob, because that is what iOS Safari
// needs in order to hand the file to the Calendar app.
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const data = await getEventBySlug(params.slug)
  if (!data || data.event.status !== 'published') {
    return new NextResponse('Event not found', { status: 404 })
  }

  const { event } = data
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bild.ae'
  const ics = buildIcs({
    uid: `event-${event.id}@bild.ae`,
    title: event.title,
    startIso: event.event_date,
    endIso: event.end_date,
    description: event.description,
    venue: event.venue,
    location: event.location,
    url: `${base}/events/${event.slug}`,
  })

  // Most slugs already start with "bild-", so don't double up the prefix.
  const filename = event.slug.startsWith('bild-') ? event.slug : `bild-${event.slug}`

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
