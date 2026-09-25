import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { revalidatePublic, directoryPaths } from '@/lib/revalidate-public'

export const dynamic = 'force-dynamic'

// Manual re-list for a delisted business - used when a business sends proof
// of a renewed document directly (email/phone) rather than via the self-service
// upload link. Admin is expected to have already corrected document_expiry_date
// via the edit form before calling this.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await req.json().catch(() => ({}))
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('business_submissions')
    .update({ delisted_at: null, delisted_reason: null })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePublic(directoryPaths())
  return NextResponse.json({ ok: true })
}
