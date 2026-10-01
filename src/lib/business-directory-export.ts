import * as XLSX from 'xlsx'
import { supabaseAdmin } from './supabase-admin'
import { readAllRows } from './db-retry'

// Builds the business-directory spreadsheet for the weekly backup email: every
// listing ever submitted, whatever its current status, so the whole directory
// (not just what's live today) can be rebuilt from this one file.
export async function buildBusinessDirectoryWorkbook(): Promise<{ buffer: Buffer; count: number }> {
  const { data, error } = await readAllRows<Record<string, unknown>>(
    'business directory backup',
    (from, to) => supabaseAdmin
      .from('business_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to),
  )
  if (error) {
    const reason = (error as { message?: string }).message || String(error)
    throw new Error(`The business directory could not be read, so no backup was produced: ${reason}`)
  }

  const rows = data.map(b => ({
    'Business name': b.business_name,
    Status: b.status,
    Category: b.category,
    Tagline: b.tagline || '',
    Description: b.description,
    Location: b.location,
    Country: b.business_country,
    'Owner name': b.owner_name,
    Phone: b.phone,
    WhatsApp: b.whatsapp || '',
    Email: b.email,
    Website: b.website || '',
    Instagram: b.instagram || '',
    LinkedIn: b.linkedin || '',
    'Google review link': b.google_maps_url || '',
    'BILD member': b.is_bild_member === false ? 'No' : 'Yes',
    'BILD member since': b.bild_member_since || '',
    'Established year': b.established_year || '',
    'BILD member offer': b.bild_offer || '',
    'Extra info': b.extra_info || '',
    'Document expiry': b.document_expiry_date || '',
    'Listing paid until': b.listing_paid_until || '',
    'Listing fee exempt': b.listing_fee_exempt ? 'Yes' : '',
    Featured: b.featured ? 'Yes' : '',
    'Delisted at': b.delisted_at || '',
    'Delisted reason': b.delisted_reason || '',
    'Admin notes': b.admin_notes || '',
    Slug: b.slug || '',
    'Submitted at': b.created_at,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Business directory')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return { buffer, count: data.length }
}
