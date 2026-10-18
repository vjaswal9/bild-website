// Pausing a directory listing.
//
// A listing is hidden everywhere (directory, profile page, sitemap, stats,
// reminders) whenever business_submissions.delisted_at is set. That is how an
// expired document already removes a listing. A pause uses the same switch, so
// nothing public needed to change, and records WHY in delisted_reason:
//
//   'document_expired'      set by the daily document check
//   'paused'                paused by an admin
//   'paused: <note>'        paused by an admin, with the reason they typed
//
// Resuming clears delisted_at and delisted_reason (the existing re-list route).
// Approving a renewed document also clears them, which is what lets a paused
// business come back by uploading the documents they were asked for.

const MAX_NOTE = 300

export function isPausedReason(reason?: string | null): boolean {
  return !!reason && /^paused(:|$)/.test(reason)
}

export function buildPauseReason(note: string): string {
  const n = String(note || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE)
  return n ? `paused: ${n}` : 'paused'
}

export function pauseNote(reason?: string | null): string {
  return isPausedReason(reason) ? String(reason).replace(/^paused:?\s*/, '') : ''
}
