import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { readMahjongInterest } from '@/lib/mahjong-admin'
import { uuid } from '@/lib/validate'
import {
  mahjongLabel, MAHJONG_EXPERIENCE_OPTIONS, MAHJONG_MEMBER_LABELS,
} from '@/lib/mahjong-interest'

export const dynamic = 'force-dynamic'

const guard = (req: NextRequest) => verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)

// Admin: the sign-ups as a spreadsheet.
export async function GET(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const rows = await readMahjongInterest()
  const sheet = XLSX.utils.json_to_sheet(rows.map(r => ({
    'Registered': new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }),
    'Name': r.full_name,
    'WhatsApp': r.whatsapp,
    'BILD member': mahjongLabel(MAHJONG_MEMBER_LABELS, r.member_status),
    'Area': r.area,
    'Experience': mahjongLabel(MAHJONG_EXPERIENCE_OPTIONS, r.experience),
    'Times': (r.availability || []).join(', '),
    'Notes': r.notes || '',
  })))
  sheet['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 18 }, { wch: 32 }, { wch: 36 }, { wch: 40 }, { wch: 40 }, { wch: 40 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Mahjong interest')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="BILD-mahjong-interest-${today}.xlsx"`,
    },
  })
}

// Admin: remove one person, for someone who asks to withdraw their details.
export async function DELETE(req: NextRequest) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const id = uuid(b.id)
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  const { error } = await supabaseAdmin.from('mahjong_interest').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not remove this person.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
