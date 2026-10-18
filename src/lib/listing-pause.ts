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

// A filter for the renewal reminder job: everything except paused listings.
// A paused business has not used its paid time, so it must not be chased to
// renew, told its listing has expired, or have its Featured status switched off
// while it is paused. (Listings removed for an expired document are NOT
// excluded: that behaviour is unchanged.) Used with Supabase's .or().
export const NOT_PAUSED_FILTER = 'delisted_reason.is.null,delisted_reason.not.like.paused*'

// Pausing stops the clock on paid time.
//
// If a business had 91 days of paid listing left when it was paused, it has 91
// days left when it is resumed, however long the pause lasted. This returns the
// new "paid until" date, or null when there is nothing to give back (no paid
// period, or it had already run out before the pause began).
export function paidTimeAfterPause(opts: {
  pausedAt?: string | null
  resumedAt: Date
  paidUntil?: string | null
}): string | null {
  if (!opts.pausedAt || !opts.paidUntil) return null
  const start = Date.parse(opts.pausedAt)
  const end = Date.parse(opts.paidUntil)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  const remaining = end - start
  if (remaining <= 0) return null
  // A resume can never be earlier than the pause it ends.
  const resumed = Math.max(opts.resumedAt.getTime(), start)
  return new Date(resumed + remaining).toISOString()
}

type ResumeInput = {
  delisted_at?: string | null
  delisted_reason?: string | null
  listing_fee_exempt?: boolean | null
  listing_paid_until?: string | null
  featured_paid_until?: string | null
}

// Everything that changes when a listing comes back from a pause (or from any
// other delisting). For a PAUSED listing the paid periods are extended by the
// time that was paused, and the "reminder already sent" markers are reset the
// same way a renewal payment resets them, so the reminders before the new date
// still go out. Other delistings are put back exactly as before.
export function resumePatch(biz: ResumeInput, now: Date = new Date()): {
  patch: Record<string, unknown>
  extended: { listing: string | null; featured: string | null }
} {
  const patch: Record<string, unknown> = { delisted_at: null, delisted_reason: null }
  const extended: { listing: string | null; featured: string | null } = { listing: null, featured: null }

  if (isPausedReason(biz.delisted_reason) && biz.delisted_at) {
    if (!biz.listing_fee_exempt) {
      const next = paidTimeAfterPause({ pausedAt: biz.delisted_at, resumedAt: now, paidUntil: biz.listing_paid_until })
      if (next) {
        patch.listing_paid_until = next
        patch.listing_renewal_reminder_sent_at = null
        patch.listing_final_reminder_sent_at = null
        patch.listing_expired_notice_sent_at = null
        extended.listing = next
      }
    }
    const nextFeatured = paidTimeAfterPause({ pausedAt: biz.delisted_at, resumedAt: now, paidUntil: biz.featured_paid_until })
    if (nextFeatured) {
      patch.featured_paid_until = nextFeatured
      patch.featured_renewal_reminder_sent_at = null
      patch.featured_final_reminder_sent_at = null
      patch.featured_expired_notice_sent_at = null
      extended.featured = nextFeatured
    }
  }
  return { patch, extended }
}
