import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, sessionIdentity, forgetSessionChecks, randomToken } from '@/lib/admin-auth'
import type { Subject } from '@/lib/admin-2fa'

// Personal admin accounts (table admin_users). While the table is empty the
// site runs on the single shared login and none of this is in play.

export type AdminUser = {
  id: string
  email: string
  name: string
  active: boolean
  last_login_at: string | null
  created_at: string
  invite_expires_at: string | null
}

export const INVITE_TTL_MS = 48 * 60 * 60 * 1000
export const MIN_ADMIN_PASSWORD = 12

export function normaliseAdminEmail(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase().slice(0, 200) : ''
}

export async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('')
}

// Which two-factor subject the signed-in person is: null for the shared
// login, an admin id for a personal account. Undefined when not signed in.
export async function subjectFromRequest(req: NextRequest): Promise<Subject | undefined> {
  const who = await sessionIdentity(req.cookies.get(ADMIN_COOKIE)?.value)
  if (who === null) return undefined
  return who === 'legacy' ? null : who
}

export async function findAdminByEmail(email: string) {
  const { data } = await supabaseAdmin
    .from('admin_users')
    .select('id, email, name, password_hash, active')
    .ilike('email', email)
    .maybeSingle()
  return data as { id: string; email: string; name: string; password_hash: string | null; active: boolean } | null
}

export async function listAdmins(): Promise<AdminUser[]> {
  const { data } = await supabaseAdmin
    .from('admin_users')
    .select('id, email, name, active, last_login_at, created_at, invite_expires_at')
    .order('created_at', { ascending: true })
  return (data || []) as AdminUser[]
}

export async function countActiveAdmins(): Promise<number> {
  const { count } = await supabaseAdmin.from('admin_users').select('id', { count: 'exact', head: true }).eq('active', true)
  return count || 0
}

// A new one-time invite link for an admin row. Only the hash is stored.
export async function issueInvite(adminId: string): Promise<{ token: string; expires: string }> {
  const token = randomToken(32)
  const expires = new Date(Date.now() + INVITE_TTL_MS).toISOString()
  await supabaseAdmin.from('admin_users').update({
    invite_token_hash: await sha256Hex(token),
    invite_expires_at: expires,
  }).eq('id', adminId)
  return { token, expires }
}

export async function findByInviteToken(token: unknown) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 200) return null
  const { data } = await supabaseAdmin
    .from('admin_users')
    .select('id, email, name, active, invite_expires_at, totp_pending_secret')
    .eq('invite_token_hash', await sha256Hex(token))
    .maybeSingle()
  const row = data as { id: string; email: string; name: string; active: boolean; invite_expires_at: string | null; totp_pending_secret: string | null } | null
  if (!row || row.active) return null
  if (!row.invite_expires_at || new Date(row.invite_expires_at).getTime() < Date.now()) return null
  return row
}

// Ends every session this person has, right now, on every server.
export async function endSessions(adminId: string) {
  await supabaseAdmin.from('admin_users').update({ sessions_valid_from: new Date().toISOString() }).eq('id', adminId)
  forgetSessionChecks()
}
