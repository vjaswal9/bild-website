import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE, signAdminToken, signAdminSession,
  personalAccountsActive, verifyPassword, hashPassword,
} from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { getTwoFactorState, checkSecondFactor } from '@/lib/admin-2fa'
import { findAdminByEmail, normaliseAdminEmail } from '@/lib/admin-accounts'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Tells the sign-in page whether to ask for an email address too: once
// personal accounts exist the site needs to know who is signing in.
export async function GET() {
  return NextResponse.json({ personal: (await personalAccountsActive()) === true })
}

const TEN_MINUTES = 10 * 60 * 1000
const tooMany = () => NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })

// A password check that takes as long when the email is unknown as when it is
// right, so response time does not reveal which addresses are admins.
let dummyHash: Promise<string> | null = null

function sessionCookie(res: NextResponse, token: string) {
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
  })
  return res
}

export async function POST(req: NextRequest) {
  // Shared across every server instance, so the limit is real. 10 tries per 10
  // minutes per address.
  if (await isRateLimitedShared(`admin-login:${getClientIp(req)}`, { windowMs: TEN_MINUTES, max: 10 })) return tooMany()

  const body = await req.json().catch(() => ({}))
  const password = typeof body?.password === 'string' ? body.password : ''
  const code = body?.code
  const personal = await personalAccountsActive()
  if (personal === null) {
    return NextResponse.json({ error: 'Could not check your sign-in settings. Please try again in a moment.' }, { status: 503 })
  }

  // ---- Personal accounts ------------------------------------------------
  if (personal) {
    const email = normaliseAdminEmail(body?.email)
    const wrong = () => NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
    if (!email || !password || password.length > 500) return wrong()
    if (await isRateLimitedShared(`admin-login-email:${email}`, { windowMs: TEN_MINUTES, max: 10 })) return tooMany()

    const user = await findAdminByEmail(email)
    if (!dummyHash) dummyHash = hashPassword('not-a-real-password-for-timing')
    const passwordOk = await verifyPassword(password, user?.active && user.password_hash ? user.password_hash : await dummyHash)
    if (!user || !user.active || !passwordOk) return wrong()

    const tf = await getTwoFactorState(user.id)
    if (!tf.ok) {
      return NextResponse.json({ error: 'Could not check your sign-in settings. Please try again in a moment.' }, { status: 503 })
    }
    if (!tf.state.enabled) {
      // Cannot happen for an account made through the invite or upgrade flow,
      // which both require an authenticator. Refuse rather than let a password
      // alone through.
      return NextResponse.json({ error: 'This account has no authenticator set up. Ask another admin to remove and re-invite you.' }, { status: 403 })
    }
    if (typeof code !== 'string' || !code.trim()) return NextResponse.json({ needsCode: true })
    // Each account has its own allowance for guessing codes, so an attacker
    // hammering one person cannot lock the other out.
    if (await isRateLimitedShared(`admin-2fa:${user.id}`, { windowMs: TEN_MINUTES, max: 15 })) return tooMany()
    if (!(await checkSecondFactor(tf.state, code, user.id))) {
      return NextResponse.json({ error: 'That code is not right.', needsCode: true }, { status: 401 })
    }

    await supabaseAdmin.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
    return sessionCookie(NextResponse.json({ ok: true }), await signAdminSession(user.id))
  }

  // ---- Single shared login (until personal accounts are switched on) -----
  if (!password) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }
  if (!(await verifyAdminPassword(password, null))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  // Second factor. A correct password alone is never enough once it is on.
  const tf = await getTwoFactorState()
  if (!tf.ok) {
    return NextResponse.json({ error: 'Could not check your sign-in settings. Please try again in a moment.' }, { status: 503 })
  }
  if (tf.state.enabled) {
    // Right password, no code yet: ask for it. No session is issued.
    if (typeof code !== 'string' || !code.trim()) return NextResponse.json({ needsCode: true })
    // One shared allowance for guessing codes across every address, so a
    // spread-out attacker who somehow holds the password still cannot grind
    // through the million possibilities.
    if (await isRateLimitedShared('admin-2fa-global', { windowMs: TEN_MINUTES, max: 15 })) return tooMany()
    if (!(await checkSecondFactor(tf.state, code))) {
      return NextResponse.json({ error: 'That code is not right.', needsCode: true }, { status: 401 })
    }
  }

  return sessionCookie(NextResponse.json({ ok: true }), await signAdminToken())
}
