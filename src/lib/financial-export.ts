import * as XLSX from 'xlsx'
import { supabaseAdmin } from './supabase-admin'
import { readAllRows } from './db-retry'

// Builds the financial-ledger spreadsheet for the weekly backup email: every
// payment and every operating cost ever recorded, exactly as the Money
// dashboard reads them, so the year's books can be rebuilt from this one file.
export async function buildFinancialWorkbook(): Promise<{ buffer: Buffer; payments: number; costs: number }> {
  const [paymentsRes, costsRes] = await Promise.all([
    readAllRows<Record<string, unknown>>(
      'payments ledger backup',
      (from, to) => supabaseAdmin
        .from('payments')
        .select('*')
        .order('paid_at', { ascending: false })
        .range(from, to),
    ),
    readAllRows<Record<string, unknown>>(
      'operating costs backup',
      (from, to) => supabaseAdmin
        .from('operating_costs')
        .select('*')
        .order('incurred_on', { ascending: false })
        .range(from, to),
    ),
  ])
  if (paymentsRes.error) {
    const reason = (paymentsRes.error as { message?: string }).message || String(paymentsRes.error)
    throw new Error(`The payments ledger could not be read, so no backup was produced: ${reason}`)
  }
  if (costsRes.error) {
    const reason = (costsRes.error as { message?: string }).message || String(costsRes.error)
    throw new Error(`Operating costs could not be read, so no backup was produced: ${reason}`)
  }

  const paymentRows = paymentsRes.data.map(p => ({
    'Paid at': p.paid_at,
    Kind: p.kind,
    Description: p.description || '',
    'Event ID': p.event_id || '',
    'Reference ID': p.reference_id || '',
    'Gross AED': p.gross_aed,
    'Revenue AED': p.revenue_aed,
    'Fee passed on AED': p.fee_passed_on_aed,
    'Stripe fee AED': p.stripe_fee_aed,
    'Refunded AED': p.refunded_aed,
    Currency: p.currency,
    'Stripe session ID': p.stripe_session_id || '',
    'Stripe charge ID': p.stripe_charge_id || '',
    Source: p.source,
    'Recorded at': p.created_at,
  }))

  const costRows = costsRes.data.map(c => ({
    'Incurred on': c.incurred_on,
    Category: c.category,
    Description: c.description,
    'Amount AED': c.amount_aed,
    'Event ID': c.event_id || '',
    Notes: c.notes || '',
    'Recorded at': c.created_at,
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(paymentRows.length ? paymentRows : [{ 'Paid at': 'No payments recorded' }]),
    'Payments',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(costRows.length ? costRows : [{ 'Incurred on': 'No operating costs recorded' }]),
    'Operating costs',
  )
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return { buffer, payments: paymentsRes.data.length, costs: costsRes.data.length }
}
