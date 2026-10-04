import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken, sessionSecretIsSeparate } from '@/lib/admin-auth'
import { imageCheckConfigured } from '@/lib/image-check'

export const dynamic = 'force-dynamic'

// What the Security page shows: whether the protective settings are in place.
// Only yes/no answers, never the values.
export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  return NextResponse.json({
    sessionSecretSeparate: sessionSecretIsSeparate(),
    cronSecretSet: !!process.env.CRON_SECRET,
    photoCheckOn: imageCheckConfigured(),
  })
}
