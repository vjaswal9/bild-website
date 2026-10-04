import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken, sessionSecretIsSeparate, personalAccountsActive } from '@/lib/admin-auth'
import { subjectFromRequest, countActiveAdmins } from '@/lib/admin-accounts'
import { imageCheckConfigured } from '@/lib/image-check'
import { getTwoFactorState } from '@/lib/admin-2fa'

export const dynamic = 'force-dynamic'

// What the Security page shows: whether the protective settings are in place.
// Only yes/no answers, never the values.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const subject = (await subjectFromRequest(req)) ?? null
  const personal = (await personalAccountsActive()) === true
  const tf = await getTwoFactorState(subject)
  return NextResponse.json({
    errorMonitoringOn: !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    personalAccounts: personal,
    adminCount: personal ? await countActiveAdmins() : 0,
    twoFactorOn: tf.ok && tf.state.enabled,
    sessionSecretSeparate: sessionSecretIsSeparate(),
    cronSecretSet: !!process.env.CRON_SECRET,
    photoCheckOn: imageCheckConfigured(),
  })
}
