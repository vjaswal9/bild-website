// Helpers for "add this event to my calendar" links.
//
// BILD events are physical events in Dubai, so entries are anchored to
// Asia/Dubai rather than emitted as bare UTC. The calendar file carries an
// explicit TZID (with the matching VTIMEZONE block the spec requires), which
// means the entry stays at its Dubai wall-clock time - including for someone
// whose phone is set to another timezone, or who is travelling when they open it.
export const EVENT_TIMEZONE = 'Asia/Dubai'

// Events without an explicit end time are assumed to run this long, so the
// calendar entry doesn't show as an all-day or zero-length block.
const DEFAULT_DURATION_HOURS = 3

// Dubai is UTC+4 all year with no daylight saving, so this block is fixed.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${EVENT_TIMEZONE}`,
  `X-LIC-LOCATION:${EVENT_TIMEZONE}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0400',
  'TZOFFSETTO:+0400',
  'TZNAME:+04',
  'END:STANDARD',
  'END:VTIMEZONE',
]

// The instant, expressed as Dubai wall-clock time (no trailing Z): the form a
// TZID-qualified DTSTART/DTEND expects.
export function toDubaiStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: EVENT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00'
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`
}

export function eventEndDate(startIso: string, endIso?: string | null): Date {
  if (endIso) return new Date(endIso)
  const end = new Date(startIso)
  end.setHours(end.getHours() + DEFAULT_DURATION_HOURS)
  return end
}

export function toCalendarStamp(date: Date): string {
  // 2026-09-08T18:30:00.000Z -> 20260908T183000Z
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

type CalendarEvent = {
  title: string
  startIso: string
  endIso?: string | null
  description?: string | null
  venue?: string | null
  location?: string | null
  url?: string
}

function locationLine(e: CalendarEvent): string {
  return [e.venue, e.location].filter(Boolean).join(', ')
}

export function googleCalendarUrl(e: CalendarEvent): string {
  // Sent as UTC instants (unambiguous), with ctz telling Google to create and
  // display the event in Dubai time.
  const start = toCalendarStamp(new Date(e.startIso))
  const end = toCalendarStamp(eventEndDate(e.startIso, e.endIso))
  const details = [e.description, e.url].filter(Boolean).join('\n\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${start}/${end}`,
    ctz: EVENT_TIMEZONE,
  })
  if (details) params.set('details', details)
  const loc = locationLine(e)
  if (loc) params.set('location', loc)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Escapes the characters that carry meaning inside an ICS value.
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// The ICS spec caps lines at 75 octets, continued by a leading space. Outlook
// in particular is strict about this, so fold rather than emit long lines.
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest) parts.push(` ${rest}`)
  return parts.join('\r\n')
}

export function buildIcs(e: CalendarEvent & { uid: string }): string {
  const loc = locationLine(e)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BILD//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE,
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    // DTSTAMP is the file's creation time, which is UTC by spec.
    `DTSTAMP:${toCalendarStamp(new Date())}`,
    `DTSTART;TZID=${EVENT_TIMEZONE}:${toDubaiStamp(new Date(e.startIso))}`,
    `DTEND;TZID=${EVENT_TIMEZONE}:${toDubaiStamp(eventEndDate(e.startIso, e.endIso))}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    ...(e.description ? [`DESCRIPTION:${escapeIcs(e.description)}`] : []),
    ...(loc ? [`LOCATION:${escapeIcs(loc)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  // ICS requires CRLF line endings.
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
