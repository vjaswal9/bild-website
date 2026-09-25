// Shared by the admin dashboard (client) and the submission API route
// (server) so the "does this claimed BILD membership actually match a paid
// member?" check stays identical in both places.

export type MemberContact = { email: string | null; phone: string | null }

// Digits only, last 9 (drops any +971/0 country/trunk prefix) so "+971 50
// 926 2115", "0509262115" and "971509262115" all compare equal.
export function normalizePhone(v: string | null | undefined): string {
  const digits = (v || '').replace(/\D/g, '')
  return digits.slice(-9)
}

export function isVerifiedMemberContact(
  claim: { email?: string | null; phone?: string | null },
  members: MemberContact[]
): boolean {
  const email = (claim.email || '').trim().toLowerCase()
  const phone = normalizePhone(claim.phone)
  return members.some(m =>
    (email && (m.email || '').trim().toLowerCase() === email) ||
    (phone && normalizePhone(m.phone) === phone)
  )
}
