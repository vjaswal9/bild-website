// Client-safe: no server imports, used by admin screens and the export alike.
//
// A "recovered" member is someone who started joining, did not pay at the time,
// and came back later and paid. Nothing is stored for this: it is worked out
// from dates the record already keeps. That works because a returning
// applicant's row is reused and its created_at is never reset, so the gap
// between starting and paying is genuine.
//
// The line is one hour, the same wait the abandoned-reminder button uses.
// Paying takes minutes, so anyone past an hour genuinely left and came back.

export const RECOVERY_THRESHOLD_MS = 60 * 60 * 1000

type MemberDates = {
  status: string
  created_at: string
  paid_at?: string | null
  abandoned_reminder_sent_at?: string | null
}

export type Recovery = {
  recovered: true
  gapMs: number
  // True when a reminder email went out before they paid. It does not prove
  // the email is why they came back, only that it was sent first.
  afterReminder: boolean
}

export function recoveryOf(m: MemberDates): Recovery | null {
  if (m.status !== 'paid' || !m.paid_at) return null
  const gapMs = new Date(m.paid_at).getTime() - new Date(m.created_at).getTime()
  if (!(gapMs > RECOVERY_THRESHOLD_MS)) return null
  const afterReminder =
    !!m.abandoned_reminder_sent_at &&
    new Date(m.abandoned_reminder_sent_at).getTime() <= new Date(m.paid_at).getTime()
  return { recovered: true, gapMs, afterReminder }
}

// "1.6 hours", "19 hours", "12 days".
export function describeGap(ms: number): string {
  const hours = ms / 3600000
  if (hours < 10) return `${hours.toFixed(1).replace(/\.0$/, '')} hours`
  if (hours < 48) return `${Math.round(hours)} hours`
  return `${Math.round(hours / 24)} days`
}

// One line for tooltips, the profile page and the spreadsheet.
export function describeRecovery(r: Recovery): string {
  return `Paid ${describeGap(r.gapMs)} after starting, ${r.afterReminder ? 'after a reminder email' : 'on their own'}`
}
