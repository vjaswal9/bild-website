import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { uuid } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const BUCKET = 'testimonial-proof'
const EXPIRY_SECONDS = 300

// A short-lived link to the screenshot backing one testimonial.
//
// The bucket is private because these are screenshots of customers' own emails
// and WhatsApp messages. They exist so an admin can check a testimonial is
// real, and for nothing else, so the link is signed per request and expires.
//
// Takes the testimonial's id rather than a storage path, so there is no way to
// ask this route for a file that is not attached to a real testimonial.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const id = uuid(body.id)
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const { data: row, error } = await supabaseAdmin
    .from('business_testimonials')
    .select('proof_path')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Could not look up a testimonial to show its proof:', error)
    return NextResponse.json({ error: 'Could not open the attachment just now. Please try again.' }, { status: 503 })
  }
  if (!row?.proof_path) {
    return NextResponse.json({ error: 'No proof was attached to this testimonial.' }, { status: 404 })
  }

  const { data, error: signError } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .createSignedUrl(row.proof_path, EXPIRY_SECONDS)

  if (signError || !data?.signedUrl) {
    console.error('Could not sign a testimonial proof URL:', signError)
    return NextResponse.json({ error: 'Could not open the attachment. It may have been removed.' }, { status: 404 })
  }

  return NextResponse.json({ url: data.signedUrl, expiresInSeconds: EXPIRY_SECONDS })
}
