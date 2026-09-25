import type { Metadata } from 'next'
import ManageLinkInvite from './ManageLinkInvite'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Send manage links',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <ManageLinkInvite />
}
