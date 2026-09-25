import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { isValidEmail, normaliseEmail } from '@/lib/email-validate'
import { optionalStr } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// Saves a partly-filled directory application.
//
// The membership form has done this for a long time - JoinForm writes a
// `members` row at the eligibility step, so somebody who leaves before paying
// is still visible and can be followed up. The directory form could not,
// because it is one page of 22 fields that only wrote a row on the final
// submit. Somebody who filled in fifteen of them and closed the tab left no
// trace at all, and a form that long is exactly where drop-off is worst.
//
// Nothing is stored until there is a usable email address: a lead nobody can
// contact is not worth keeping, and holding the details of someone who typed
// two characters into a box would be hard to justify.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (isRateLimited(`dir-lead:${ip}`, { windowMs: 60 * 1000, max: 12 })) {
    return new NextResponse(null, { status: 204 })
  }

  const b = await req.json().catch(() => ({}))
  if (!b?.email || !isValidEmail(b.email)) return new NextResponse(null, { status: 204 })
  const email = normaliseEmail(b.email)

  const row = {
    email,
    business_name: optionalStr(b.business_name, 200),
    owner_name: optionalStr(b.owner_name, 200),
    phone: optionalStr(b.phone, 60),
    category: optionalStr(b.category, 120),
    location: optionalStr(b.location, 200),
    fields_filled: Math.max(0, Math.min(40, Number(b.fields_filled) || 0)),
    updated_at: new Date().toISOString(),
  }

  // Upsert on the email, so somebody returning to finish later updates their
  // own lead rather than creating a second one.
  const { error } = await supabaseAdmin
    .from('directory_leads')
    .upsert(row, { onConflict: 'email' })
  if (error) console.error('directory lead: could not save', error.message)

  return new NextResponse(null, { status: 204 })
}
