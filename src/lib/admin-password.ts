import { supabaseAdmin } from './supabase-admin'
import { cookies } from 'next/headers'
import { verifyPassword, hashPassword, needsRehash, sessionIdentity, personalAccountsActive, ADMIN_COOKIE } from './admin-auth'

// The DB-stored password hash (set once an admin changes their password via
// the Security page) is authoritative when present; otherwise falls back to
// the ADMIN_PASSWORD env var (bootstrap, before any change has been made).
// Centralised here so every password re-confirmation (login, changing the
// password itself, the Manage-event gate, deleting an event or a
// registration) checks the admin's actual current password, not a stale
// env var, once they've changed it.
export async function verifyAdminPassword(candidate: string, userId?: string | null): Promise<boolean> {
  if (!candidate || typeof candidate !== 'string') return false

  // Who is asking. Callers that have already checked the session do not pass
  // anyone: the person is read from the sign-in cookie. The login route passes
  // the account it is signing in explicitly.
  let id: string | null
  if (userId !== undefined) id = userId
  else {
    const who = await sessionIdentity(cookies().get(ADMIN_COOKIE)?.value)
    id = who && who !== 'legacy' ? who : null
  }

  if (id) {
    const { data } = await supabaseAdmin.from('admin_users').select('password_hash, active').eq('id', id).maybeSingle()
    const row = data as { password_hash?: string | null; active?: boolean } | null
    if (!row?.active || !row.password_hash) return false
    const ok = await verifyPassword(candidate, row.password_hash)
    if (ok && needsRehash(row.password_hash)) {
      try {
        await supabaseAdmin.from('admin_users').update({ password_hash: await hashPassword(candidate) }).eq('id', id)
      } catch (e) {
        console.error('Could not upgrade an admin password hash:', e)
      }
    }
    return ok
  }

  // The shared login must not answer once personal accounts exist, even if
  // somebody reaches this without a session.
  if ((await personalAccountsActive()) !== false) return false

  const { data } = await supabaseAdmin.from('admin_settings').select('password_hash').eq('id', 1).maybeSingle()
  const storedHash = (data as { password_hash?: string | null } | null)?.password_hash
  if (storedHash) {
    const ok = await verifyPassword(candidate, storedHash)
    // Quietly move an older, cheaper hash up to the current strength now that
    // we hold the plaintext. A failure here must never fail the sign-in.
    if (ok && needsRehash(storedHash)) {
      try {
        await supabaseAdmin.from('admin_settings').update({ password_hash: await hashPassword(candidate) }).eq('id', 1)
      } catch (e) {
        console.error('Could not upgrade the admin password hash:', e)
      }
    }
    return ok
  }
  return !!process.env.ADMIN_PASSWORD && candidate === process.env.ADMIN_PASSWORD
}
