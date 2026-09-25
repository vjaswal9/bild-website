import { supabaseAdmin } from './supabase-admin'
import { verifyPassword } from './admin-auth'

// The DB-stored password hash (set once an admin changes their password via
// the Security page) is authoritative when present; otherwise falls back to
// the ADMIN_PASSWORD env var (bootstrap, before any change has been made).
// Centralised here so every password re-confirmation (login, changing the
// password itself, the Manage-event gate, deleting an event or a
// registration) checks the admin's actual current password, not a stale
// env var, once they've changed it.
export async function verifyAdminPassword(candidate: string): Promise<boolean> {
  if (!candidate) return false
  const { data } = await supabaseAdmin.from('admin_settings').select('password_hash').eq('id', 1).maybeSingle()
  const storedHash = (data as { password_hash?: string | null } | null)?.password_hash
  if (storedHash) return verifyPassword(candidate, storedHash)
  return !!process.env.ADMIN_PASSWORD && candidate === process.env.ADMIN_PASSWORD
}
