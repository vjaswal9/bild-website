import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('bild_admin')?.value
  if (token !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, featured } = await req.json()

  const { error } = await supabaseAdmin
    .from('business_submissions')
    .update({ featured: !!featured })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
