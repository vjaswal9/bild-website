import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { verifyAdminPassword } from '@/lib/admin-password'
import { revalidatePublic, directoryPaths } from '@/lib/revalidate-public'

export const dynamic = 'force-dynamic'

// Deleting a business is permanent and unrecoverable: the listing, its
// licence document reference, its payment history link and its Featured
// state all go. The standing admin session is not enough on its own, so the
// password is re-checked here rather than only in the browser, which means
// the confirmation cannot be skipped by calling the endpoint directly.
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, password } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const { error } = await supabaseAdmin.from('business_submissions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublic(directoryPaths())
  return NextResponse.json({ ok: true })
}
