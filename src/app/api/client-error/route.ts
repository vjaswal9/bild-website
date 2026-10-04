import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getClientIp, isRateLimited, isRateLimitedShared } from '@/lib/rate-limit'
import { shouldIgnoreBrowserError, BrowserError } from '@/lib/error-beacon'
import { scrubString } from '@/lib/sentry-scrub'

export const dynamic = 'force-dynamic'

// Receives the short error notes the inline browser beacon posts (see
// src/lib/error-beacon.ts) and passes the real ones to Sentry.
//
// Public by necessity, so it is built to be hard to abuse: it only takes a
// small body, ignores anything that is not from our own pages, caps how much a
// single address and the whole site can send, drops repeats, and always
// answers 204 so a browser never retries. Sentry's free plan has a monthly
// event allowance, and this is the one route where a stranger could otherwise
// spend it.
const OUR_HOSTS = ['bild.ae', 'localhost', '127.0.0.1']
const MAX_BYTES = 4 * 1024
const seen = new Map<string, number>()
const DEDUPE_MS = 10 * 60 * 1000

const quiet = () => new NextResponse(null, { status: 204 })

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

export async function POST(req: NextRequest) {
  // Only our own pages post here.
  const origin = req.headers.get('origin') || req.headers.get('referer') || ''
  try {
    const host = new URL(origin).hostname
    if (!OUR_HOSTS.some(h => host === h || host.endsWith('.' + h))) return quiet()
  } catch { return quiet() }

  if (isRateLimited(`client-error:${getClientIp(req)}`, { windowMs: 60 * 1000, max: 10 })) return quiet()

  let e: BrowserError
  try {
    const text = await req.text()
    if (text.length > MAX_BYTES) return quiet()
    const b = JSON.parse(text)
    e = {
      m: str(b?.m, 300), s: str(b?.s, 200), st: str(b?.st, 1500), p: str(b?.p, 200),
      l: Number(b?.l) || 0, c: Number(b?.c) || 0,
    }
  } catch { return quiet() }
  if (!e.m || shouldIgnoreBrowserError(e, OUR_HOSTS)) return quiet()

  // The same error from the same place is reported once per ten minutes per
  // server, however many visitors hit it.
  const key = `${e.m}|${e.s}|${e.l}`
  const now = Date.now()
  if ((seen.get(key) ?? 0) > now - DEDUPE_MS) return quiet()
  if (seen.size > 200) seen.clear()
  seen.set(key, now)

  // A site-wide ceiling, kept in the database so it holds across servers: a
  // flood of fake reports cannot use up the monthly Sentry allowance.
  if (await isRateLimitedShared('client-error-global', { windowMs: 60 * 60 * 1000, max: 60 })) return quiet()

  Sentry.withScope(scope => {
    scope.setTag('flow', 'browser')
    scope.setLevel('error')
    scope.setContext('browser', {
      page: scrubString(e.p),
      source: scrubString(e.s),
      line: e.l,
      column: e.c,
      stack: scrubString(e.st),
      userAgent: (req.headers.get('user-agent') || '').slice(0, 160),
    })
    scope.setFingerprint(['browser', e.m.replace(/\d+/g, 'N'), e.s])
    Sentry.captureMessage(`Browser error: ${scrubString(e.m)}`)
  })
  return quiet()
}
