// Calendar-day arithmetic that gives the same answer on the server and in every
// browser. Dubai is UTC+4 all year with no daylight saving, so "today in Dubai" is
// just the clock four hours ahead of UTC.
//
// The admin pages used to work out "N days left" with the machine's own local
// midnight. The server (UTC) and an admin's browser (Dubai, or anywhere else)
// disagree about which day it is for part of every day, so the text the server
// sent and the text the browser worked out differed, and React logged a
// hydration mismatch (error 425) on the Directory page.
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000

// Today's date in Dubai, as YYYY-MM-DD.
export function dubaiToday(now: number = Date.now()): string {
  return new Date(now + DUBAI_OFFSET_MS).toISOString().slice(0, 10)
}

// Whole days from today (Dubai) to a YYYY-MM-DD date. Negative when it has passed.
export function daysUntilDubai(dateStr: string, now: number = Date.now()): number {
  const target = Date.parse(`${String(dateStr).slice(0, 10)}T00:00:00Z`)
  const today = Date.parse(`${dubaiToday(now)}T00:00:00Z`)
  if (Number.isNaN(target)) return NaN
  return Math.round((target - today) / (24 * 60 * 60 * 1000))
}
