import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyTotp, hashRecoveryCode, normaliseRecoveryCode } from '@/lib/totp'

// Server-side half of the admin two-factor login: reads the stored state and
// checks a typed code against it. The authenticator maths lives in totp.ts.

export type TwoFactorState = {
  // False when the database has no two-factor columns yet (the SQL has not
  // been run). That is treated as "not enabled" rather than an error, so
  // deploying this code before running the SQL cannot lock anybody out.
  available: boolean
  enabled: boolean
  secret: string | null
  pendingSecret: string | null
  recovery: string[]
  lastStep: number | null
}

type Row = {
  totp_secret: string | null
  totp_pending_secret: string | null
  totp_enabled: boolean
  totp_recovery: string[] | null
  totp_last_step: number | null
}

const COLUMNS = 'totp_secret, totp_pending_secret, totp_enabled, totp_recovery, totp_last_step'

// ok:false means "could not tell". Callers must refuse to sign anybody in on
// that, because guessing "not enabled" on a database hiccup would let a
// password alone through for as long as the hiccup lasts.
export async function getTwoFactorState(): Promise<{ ok: true; state: TwoFactorState } | { ok: false }> {
  const { data, error } = await supabaseAdmin.from('admin_settings').select(COLUMNS).eq('id', 1).maybeSingle()
  if (error) {
    if (error.code === '42703' || /totp_/.test(error.message)) {
      return { ok: true, state: { available: false, enabled: false, secret: null, pendingSecret: null, recovery: [], lastStep: null } }
    }
    console.error('Two-factor state unreadable:', error.message)
    return { ok: false }
  }
  const r = (data || {}) as Partial<Row>
  return {
    ok: true,
    state: {
      available: true,
      enabled: !!r.totp_enabled && !!r.totp_secret,
      secret: r.totp_secret ?? null,
      pendingSecret: r.totp_pending_secret ?? null,
      recovery: Array.isArray(r.totp_recovery) ? r.totp_recovery : [],
      lastStep: r.totp_last_step != null ? Number(r.totp_last_step) : null,
    },
  }
}

// Accepts either a 6-digit authenticator code or one of the one-time recovery
// codes. A used authenticator step and a used recovery code are both burned.
export async function checkSecondFactor(state: TwoFactorState, typed: string): Promise<boolean> {
  if (!state.enabled || !state.secret) return false
  const trimmed = typed.trim()

  if (/^\d[\d\s]{4,}$/.test(trimmed)) {
    const step = await verifyTotp(state.secret, trimmed, state.lastStep)
    if (step == null) return false
    // Only record the step if nobody has recorded an equal or newer one in the
    // meantime: two simultaneous sign-ins with the same code cannot both win.
    const { data } = await supabaseAdmin
      .from('admin_settings')
      .update({ totp_last_step: step })
      .eq('id', 1)
      .or(`totp_last_step.is.null,totp_last_step.lt.${step}`)
      .select('id')
    return (data || []).length === 1
  }

  if (normaliseRecoveryCode(trimmed).length === 10) {
    const hash = await hashRecoveryCode(trimmed)
    if (!state.recovery.includes(hash)) return false
    const { error } = await supabaseAdmin
      .from('admin_settings')
      .update({ totp_recovery: state.recovery.filter(h => h !== hash) })
      .eq('id', 1)
    return !error
  }
  return false
}
