import type { Metadata } from 'next'

// The submit page itself is a client component, so it cannot export metadata.
// Without this it fell back to the site-wide default and appeared in search
// results and link previews as "BILD: British Indians Living in Dubai" with
// the homepage description, which says nothing about listing a business.
// Same timer as the other pages showing the Google rating badge.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'List Your Business',
  description:
    'List your business in the BILD Business Directory and reach 2,000+ British Indians across the UAE. Open to BILD members and non-members. Submitting is free.',
  openGraph: {
    title: 'List Your Business in the BILD Business Directory',
    description:
      'Reach 2,000+ British Indians across the UAE with a profile in the BILD Business Directory. Open to members and non-members alike.',
  },
}

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return children
}
