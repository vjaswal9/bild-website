import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { revalidatePublic, directoryPaths } from '@/lib/revalidate-public'
import { resumePatch } from '@/lib/listing-pause'

export const dynamic = 'force-dynamic'

// Puts a delisted or paused business back on the directory.
//
// Used to resume a listing an admin paused, and for a manual re-list of a
// business that sent proof of a renewed document directly (email/phone) rather
// than via the self-service upload link. For an expired document the admin is
// expected to have already corrected document_expiry_date via the edit form.
//
// Resuming a PAUSED listing also gives back the paid time that was paused (see
// resumePatch in src/lib/listing-pause.ts).
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await req.json().catch(() => ({}))
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { data: biz, error: readError } = await supabaseAdmin
    .from('business_submissions')
    .select('id, delisted_at, delisted_reason, listing_fee_exempt, listing_paid_until, featured_paid_until')
    .eq('id', id)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!biz) return NextResponse.json({ error: 'That business was not found.' }, { status: 404 })

  const { patch, extended } = resumePatch(biz)

  // The .not() guard means a second click cannot give the paid time back twice.
  const { data: updated, error } = await supabaseAdmin
    .from('business_submissions')
    .update(patch)
    .eq('id', id)
    .not('delisted_at', 'is', null)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'This listing is already live.' }, { status: 409 })
  }

  revalidatePublic(directoryPaths())
  return NextResponse.json({ ok: true, extended })
}
