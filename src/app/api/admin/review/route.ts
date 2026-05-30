import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  // Verify admin cookie
  const token = req.cookies.get('bild_admin')?.value
  if (token !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, action, admin_notes } = await req.json()

  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('business_submissions')
    .update({
      status: action,
      admin_notes: admin_notes || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
