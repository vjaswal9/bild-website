// Plain utility - kept out of DirectoryClient.tsx (a 'use client' file)
// so server components (e.g. directory/[slug]/page.tsx) can import it too.
export function formatMemberSince(ym?: string) {
  if (!ym) return null
  const [y, m] = ym.split('-')
  if (!y) return null
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const monthName = m ? months[parseInt(m, 10) - 1] : ''
  return monthName ? `${monthName} ${y}` : y
}
