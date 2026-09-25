'use client'

import { usePathname } from 'next/navigation'

// Wraps every page's content in the site's entrance animation.
//
// This deliberately uses a CSS animation rather than Framer Motion. A JS
// animation starting at opacity 0 keeps ALL page content invisible until React
// has hydrated, which measured roughly 5 seconds of Largest Contentful Paint
// delay on a throttled mobile connection. CSS starts at first paint instead.
//
// The pathname key remounts the wrapper on each client-side navigation, so the
// animation still replays when moving between pages.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  )
}
