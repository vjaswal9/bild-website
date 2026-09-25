// Server-only. Recording and reading directory statistics.
//
// These numbers are shown to paying customers as the reason Featured is worth
// buying, so they have to survive "really?". Two things follow from that:
// repeat visits from the same person are collapsed to one per day, and obvious
// crawlers are excluded entirely. A count that is smaller and defensible beats
// a bigger one that falls apart the first time somebody checks it.

import { createHash } from 'crypto'
import { supabaseAdmin } from './supabase-admin'

export const EVENT_KINDS = [
  'view',
  'click_phone',
  'click_whatsapp',
  'click_email',
  'click_website',
  'click_instagram',
  'click_brochure',
  'click_maps',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export function isEventKind(v: unknown): v is EventKind {
  return typeof v === 'string' && (EVENT_KINDS as readonly string[]).includes(v)
}

// How each kind reads in the dashboard and the monthly email.
export const KIND_LABEL: Record<EventKind, string> = {
  view: 'Profile views',
  click_phone: 'Phone taps',
  click_whatsapp: 'WhatsApp messages started',
  click_email: 'Email clicks',
  click_website: 'Website visits',
  click_instagram: 'Instagram visits',
  click_brochure: 'Brochure downloads',
  click_maps: 'Map / directions taps',
}

// Everything except the view itself. These are what a business actually cares
// about: somebody who taps a phone number is a lead, somebody who scrolls past
// is not.
export const CLICK_KINDS = EVENT_KINDS.filter(k => k !== 'view') as Exclude<EventKind, 'view'>[]

// Deliberately broad. A false positive costs one uncounted view; a false
// negative inflates a number BILD is using to justify a fee.
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|monitor|headless|lighthouse|pingdom|curl|wget|python-requests|node-fetch|axios|postman|scrapy|semrush|ahrefs|mj12|dotbot|petal|yandex|baidu|applebot|gptbot|claudebot|ccbot|perplexity/i

export function isBot(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim().length < 10) return true
  return BOT.test(userAgent)
}

// One identity per visitor, per listing, per kind, per day.
//
// Built from the IP and user agent rather than a cookie, because the profile
// page is a Server Component and cannot set one. It is salted and hashed, so
// what lands in the database cannot be turned back into an IP address - these
// rows are a de-duplication device, not a visitor log, and they are pruned
// after three days.
export function visitorHash(args: {
  ip: string
  userAgent: string | null
  businessId: string
  kind: EventKind
  day?: string
}): string {
  const day = args.day || new Date().toISOString().slice(0, 10)
  const salt = process.env.SUPABASE_SERVICE_KEY?.slice(0, 16) || 'bild'
  return createHash('sha256')
    .update(`${salt}|${day}|${args.businessId}|${args.kind}|${args.ip}|${args.userAgent || ''}`)
    .digest('hex')
    .slice(0, 40)
}

// Fire-and-forget. A statistic must never be the reason a profile page fails
// to render, so every failure here is swallowed after being logged.
export async function recordEvent(args: {
  businessId: string
  kind: EventKind
  ip: string
  userAgent: string | null
}): Promise<boolean> {
  if (isBot(args.userAgent)) return false
  const hash = visitorHash(args)
  const { data, error } = await supabaseAdmin.rpc('record_directory_event', {
    p_business: args.businessId,
    p_kind: args.kind,
    p_hash: hash,
  })
  if (error) {
    console.error('directory stats: could not record', args.kind, error.message)
    return false
  }
  return data === true
}

export type StatRow = { kind: string; day: string; count: number }
export type Totals = Partial<Record<EventKind, number>>

function sum(rows: StatRow[]): Totals {
  const out: Totals = {}
  for (const r of rows) {
    if (!isEventKind(r.kind)) continue
    out[r.kind] = (out[r.kind] || 0) + (Number(r.count) || 0)
  }
  return out
}

export function daysAgoIso(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Every stat for one listing, split into the windows the dashboard shows. */
export async function statsForBusiness(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from('directory_events')
    .select('kind, day, count')
    .eq('business_id', businessId)
    .gte('day', daysAgoIso(90))
    .order('day', { ascending: true })
  if (error) throw new Error(`Could not load statistics: ${error.message}`)

  const rows = (data || []) as StatRow[]
  const cut30 = daysAgoIso(30)
  const cut60 = daysAgoIso(60)
  const last30 = rows.filter(r => r.day >= cut30)
  const prev30 = rows.filter(r => r.day >= cut60 && r.day < cut30)

  return {
    rows,
    last30: sum(last30),
    prev30: sum(prev30),
    allTime: sum(rows),
    // Per-day view series for the sparkline, oldest first, zero-filled.
    daily: (() => {
      const byDay = new Map<string, number>()
      for (const r of last30) if (r.kind === 'view') byDay.set(r.day, (byDay.get(r.day) || 0) + r.count)
      const out: { day: string; count: number }[] = []
      for (let i = 29; i >= 0; i--) {
        const d = daysAgoIso(i)
        out.push({ day: d, count: byDay.get(d) || 0 })
      }
      return out
    })(),
  }
}

/** Totals per listing over a window - for the admin table and the monthly email. */
export async function statsForAll(sinceIso: string) {
  const { data, error } = await supabaseAdmin
    .from('directory_events')
    .select('business_id, kind, count')
    .gte('day', sinceIso)
  if (error) throw new Error(`Could not load statistics: ${error.message}`)

  const per = new Map<string, Totals>()
  for (const r of (data || []) as ({ business_id: string } & StatRow)[]) {
    if (!isEventKind(r.kind)) continue
    const t = per.get(r.business_id) || {}
    t[r.kind] = (t[r.kind] || 0) + (Number(r.count) || 0)
    per.set(r.business_id, t)
  }
  return per
}

/** Total clicks across every kind - the headline number for a business. */
export function totalClicks(t: Totals): number {
  return CLICK_KINDS.reduce((n, k) => n + (t[k] || 0), 0)
}
