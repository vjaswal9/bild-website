import { supabaseAdmin } from './supabase-admin'
import { readAllRows } from './db-retry'

export type MahjongRow = {
  id: string
  created_at: string
  updated_at: string
  full_name: string
  whatsapp: string
  whatsapp_digits: string
  member_status: string
  area: string
  experience: string
  availability: string[] | null
  notes: string | null
}

// Everyone who has registered, newest first. A failure is raised rather than
// swallowed, so a database that is merely unreachable cannot show (or export)
// an empty list that looks like nobody has signed up.
export async function readMahjongInterest(): Promise<MahjongRow[]> {
  const { data, error } = await readAllRows<MahjongRow>(
    'mahjong interest',
    (from, to) => supabaseAdmin
      .from('mahjong_interest')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to),
  )
  if (error) {
    const reason = (error as { message?: string }).message || String(error)
    throw new Error(`The Mahjong list could not be read: ${reason}`)
  }
  return data
}
