import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Receives the Content-Security-Policy-Report-Only notes browsers send when a
// page loads something the trial policy would have blocked.
//
// Public by necessity (browsers post these without cookies), so it is small on
// purpose: it only reads a few fields, writes one line to the Vercel logs,
// never touches the database, caps the body size and is rate limited. Always
// answers 204 so a browser never retries.
//
// Search the logs for "CSP-REPORT" to see what would be blocked.

const seen = new Set<string>()
const MAX_BYTES = 10 * 1024

// Reports caused by the visitor's own browser extensions say nothing about the
// site, so they are dropped.
const EXTENSION = /^(chrome|moz|safari|edge)-extension:|^safari-web-extension:/i

function origin(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  if (/^(inline|eval|data|blob|about|self)$/i.test(value)) return value.toLowerCase()
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : u.protocol
  } catch { return value.slice(0, 40) }
}

export async function POST(req: NextRequest) {
  if (isRateLimited(`csp-report:${getClientIp(req)}`, { windowMs: 60 * 1000, max: 30 })) {
    return new NextResponse(null, { status: 204 })
  }
  try {
    const text = await req.text()
    if (text.length > MAX_BYTES) return new NextResponse(null, { status: 204 })
    const body = JSON.parse(text)
    const r = body?.['csp-report'] ?? body
    const directive = String(r?.['effective-directive'] || r?.['violated-directive'] || '').split(' ')[0].slice(0, 40)
    const blocked = origin(r?.['blocked-uri'] ?? r?.blockedURL)
    const source = String(r?.['source-file'] ?? r?.sourceFile ?? '')
    if (!directive || EXTENSION.test(blocked) || EXTENSION.test(source)) return new NextResponse(null, { status: 204 })

    let page = ''
    try { page = new URL(String(r?.['document-uri'] ?? r?.documentURL)).pathname } catch { /* ignore */ }

    // One line per distinct problem per server instance, not one per page view.
    const key = `${directive}|${blocked}|${page}`
    if (seen.size > 300) seen.clear()
    if (!seen.has(key)) {
      seen.add(key)
      console.warn(`CSP-REPORT directive=${directive} blocked=${blocked || '-'} page=${page || '-'}`)
    }
  } catch { /* malformed report: ignore */ }
  return new NextResponse(null, { status: 204 })
}
