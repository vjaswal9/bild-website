import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// All BILD events are in Dubai, so times are always shown in Dubai's
// timezone regardless of where the code happens to run - a server renders
// in UTC (Vercel), which without this would show "19:00 Dubai" as "15:00".
const EVENT_TIMEZONE = 'Asia/Dubai'

export function formatEventDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: EVENT_TIMEZONE,
  })
}

export function formatMonthYear(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

export function formatEventTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: EVENT_TIMEZONE,
  })
}

export function isUpcoming(isoString: string): boolean {
  return new Date(isoString) > new Date()
}

// Accepts a URL typed with or without a scheme (e.g. "www.foo.com" or
// "https://www.foo.com") and returns a URL that will always work as a link.
// Returns null for empty input.
export function normalizeWebsiteUrl(input?: string | null): string | null {
  const trimmed = (input || '').trim()
  if (!trimmed) return null
  // Upgrade http to https rather than passing it through. Two directory
  // listings were sending visitors to a page the browser marks "not secure",
  // and both sites served https perfectly well. Every site worth linking to
  // supports https, and one that does not will redirect anyway.
  if (/^http:\/\//i.test(trimmed)) return `https://${trimmed.replace(/^http:\/\//i, '')}`
  return /^https:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

// The site never uses em/en dashes (house style) — this strips any a
// submitter pastes in from elsewhere so it can never reach the database.
export function stripDashes<T>(input: T): T {
  return typeof input === 'string' ? (input.replace(/[—–]/g, '-') as unknown as T) : input
}
