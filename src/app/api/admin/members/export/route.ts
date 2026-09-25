import { NextRequest, NextResponse } from 'next/server'
import { buildMembersWorkbook } from '@/lib/members-export'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
// Reads and formats the whole membership before it can answer.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Allowed via the admin cookie OR a cron secret (for the scheduled backup job)
  const cookieOk = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
  const cronSecret = process.env.CRON_SECRET
  const cronOk = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret
  if (!cookieOk && !cronOk) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { buffer } = await buildMembersWorkbook()

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="BILD-members-${today}.xlsx"`,
    },
  })
}
