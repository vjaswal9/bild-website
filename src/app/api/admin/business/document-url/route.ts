import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { str } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const BUCKET = 'business-licenses'
const EXPIRY_SECONDS = 300

// Hands an admin a short-lived link to one business's trade licence document.
//
// The admin screen used to mint this link in the browser, with the anon key.
// That only worked because the anon key had read access to the whole
// business-licenses bucket, and the anon key is published in the JavaScript of
// every page on the site. Anyone who read it could list the bucket and
// download every business's licence. Verified on 2026-09-18: a request with
// only the public key returned HTTP 206 for a real document.
//
// Signing moves here so that permission can be taken away from the public key
// without the admin losing the ability to review documents. The service-role
// key bypasses storage policies, so this keeps working after the lockdown.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const path = str(body.path, 500)
  if (!path) return NextResponse.json({ error: 'Missing document path.' }, { status: 400 })

  // Only sign paths that a business record actually points at. Without this
  // the route would sign any path handed to it, which turns an admin session
  // into a way to read anything in the bucket by guessing names.
  const { data: owner, error } = await supabaseAdmin
    .from('business_submissions')
    .select('id')
    .or(`document_url.eq.${path},pending_document_url.eq.${path}`)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Could not check which business a document belongs to:', error)
    return NextResponse.json({ error: 'Could not open the document just now. Please try again.' }, { status: 503 })
  }
  if (!owner) {
    return NextResponse.json({ error: 'That document is not attached to any listing.' }, { status: 404 })
  }

  const { data, error: signError } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .createSignedUrl(path, EXPIRY_SECONDS)

  if (signError || !data?.signedUrl) {
    console.error('Could not sign a document URL:', signError)
    return NextResponse.json({ error: 'Could not open the document. It may have been removed.' }, { status: 404 })
  }

  return NextResponse.json({ url: data.signedUrl, expiresInSeconds: EXPIRY_SECONDS })
}
