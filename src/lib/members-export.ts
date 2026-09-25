import * as XLSX from 'xlsx'
import { supabaseAdmin } from './supabase-admin'
import { readAllRows } from './db-retry'
import { originEstimateText } from './name-origin'
import { recoveryOf, describeRecovery } from './member-recovery'

// Builds the members spreadsheet (same output for the admin download button
// and the scheduled email backup). Returns the xlsx as a Buffer.
export async function buildMembersWorkbook(): Promise<{ buffer: Buffer; count: number }> {
  // Paged, and a failure is raised rather than swallowed.
  //
  // This read used to discard its error and fall back to an empty list, so a
  // database that was merely unreachable produced a spreadsheet with no
  // members in it, emailed to the admins as that week's backup, reported as a
  // success. It was also unbounded, so once the membership passed the
  // database's per-request row cap the file would have silently stopped at
  // the cap. A backup is the one thing that has to fail loudly.
  const { data, error } = await readAllRows<Record<string, unknown>>(
    'members backup',
    (from, to) => supabaseAdmin
      .from('members')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to),
  )
  if (error) {
    const reason = (error as { message?: string }).message || String(error)
    throw new Error(`The members list could not be read, so no backup was produced: ${reason}`)
  }

  const members = data

  // Flatten the `details` jsonb into columns for the spreadsheet
  const rows = members.map((m: Record<string, unknown>) => {
    const details = (m.details as Record<string, unknown>) || {}
    return {
      'Full Name': m.full_name,
      Email: m.email,
      Phone: m.phone,
      Gender: m.gender,
      Emirate: m.location,
      // Computed on export from the name, never stored against the member.
      'Estimated Ai Ethnicity Search': originEstimateText(m.full_name as string),
      Status: m.status,
      'Paid At': m.paid_at,
      // Blank unless they left without paying and came back later to pay.
      'Recovered Sign-up': (() => {
        const r = recoveryOf(m as { status: string; created_at: string; paid_at?: string | null; abandoned_reminder_sent_at?: string | null })
        return r ? describeRecovery(r) : ''
      })(),
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
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return { buffer, count: members.length }
}
