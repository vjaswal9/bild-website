import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Admin-cookie gated (same cookie as the directory admin)
  const token = req.cookies.get('bild_admin')?.value
  if (token !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data } = await supabaseAdmin
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })

  const members = data || []

  // Flatten the `details` jsonb into columns for the spreadsheet
  const rows = members.map((m: Record<string, unknown>) => {
    const details = (m.details as Record<string, unknown>) || {}
    return {
      'Full Name': m.full_name,
      Email: m.email,
      Phone: m.phone,
      Gender: m.gender,
      Emirate: m.location,
      Status: m.status,
      'Paid At': m.paid_at,
      'Year of Birth': details.yearOfBirth,
      'UK City': details.ukCity,
      'India City': details.indiaCity,
      Religion: details.religion,
      'WhatsApp Number': details.whatsappNumber,
      Instagram: details.instagram,
      'Moved to UAE': details.movedDate,
      'How Heard': details.howHeard,
      'Referrer Name': details.referrerName,
      'Referrer Mobile': details.referrerMobile,
      'Marital Status': details.maritalStatus,
      'Has Children': details.hasChildren,
      "Children's Ages": details.childrenAges,
      'Partner Name': details.partnerName,
      'Partner Mobile': details.partnerMobile,
      'Business Type': details.businessType,
      'Company Name': details.companyName,
      Industry: details.industry,
      'Job Title': details.jobTitle,
      LinkedIn: details.linkedin,
      'Sponsor Interest': details.sponsorInterest,
      'Promo Interest': details.promoInterest,
      'Created At': m.created_at,
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Members')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="BILD-members-${today}.xlsx"`,
    },
  })
}
