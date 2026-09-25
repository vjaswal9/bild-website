import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'

export const dynamic = 'force-dynamic'

// Permanently deletes an event registration (e.g. a test application, or a
// duplicate). This is a hard delete and does not touch Stripe - for a real
// paid ticket that needs money back, use the Refund action instead.
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, password } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  // Deleting an application is destructive - re-confirm the admin password.
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password. Application was not deleted.' }, { status: 401 })
  }

  const { error } = await supabaseAdmin.from('event_registrations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
