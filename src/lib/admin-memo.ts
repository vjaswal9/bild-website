// The short private memo an admin can attach to a booking or a waiting-list
// entry. The same limit is enforced in the database (supabase/event-admin-memo.sql),
// by the save route, and by the input on the admin screen.
export const ADMIN_MEMO_MAX = 45

// Newlines, tabs and other control characters become single spaces, so the
// memo stays one tidy line in the admin list and in a spreadsheet cell.
// An empty result is null, which clears the memo.
export function cleanAdminMemo(value: string | null): string | null {
  if (value == null) return null
  const s = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/ {2,}/g, ' ').trim()
  return s === '' ? null : s
}

// Counted as the database counts it, in characters rather than UTF-16 units,
// so an emoji is one character here as it is there.
export const memoLength = (s: string) => Array.from(s).length
