import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Lightweight health check that touches the database, keeping the
// Supabase free-tier project from auto-pausing due to inactivity.
export async function GET() {
  try {
    await supabaseAdmin.from('members').select('id', { count: 'exact', head: true })
    return NextResponse.json({ ok: true, ts: Date.now() })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
