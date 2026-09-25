import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE, signAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'

export const dynamic = 'force-dynamic'

// Best-effort in-memory throttle. Serverless instances aren't shared, so this
// isn't bulletproof, but it slows down brute-force attempts per instance.
const attempts = new Map<string, { count: number; first: number }>()
const WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 10

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now })
    return false
  }
  rec.count += 1
  return rec.count > MAX_ATTEMPTS
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    )
  }

  const { password } = await req.json().catch(() => ({ password: '' }))
  if (!password) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const token = await signAdminToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
  })
  return res
}
