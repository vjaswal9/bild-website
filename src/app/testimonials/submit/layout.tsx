import type { Metadata } from 'next'

// The submit page is a client component, so it cannot export metadata itself.
export const metadata: Metadata = {
  title: 'Share Your Experience',
  description: 'Tell other members what BILD means to you.',
}

export default function SubmitTestimonialLayout({ children }: { children: React.ReactNode }) {
  return children
}
