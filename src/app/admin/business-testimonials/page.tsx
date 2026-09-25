import type { Metadata } from 'next'
import BusinessTestimonialsAdmin from './BusinessTestimonialsAdmin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Business Testimonials',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <BusinessTestimonialsAdmin />
}
