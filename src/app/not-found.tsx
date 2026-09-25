import Link from 'next/link'
import type { Metadata } from 'next'
import { Home, Calendar, Store, Mail } from 'lucide-react'
import { btnPrimary } from '@/lib/ui'
import { isLivePath } from '@/lib/launch'

export const metadata: Metadata = {
  title: 'Page not found',
  // Belt and braces: a 404 already tells crawlers not to index, and this
  // makes it explicit.
  robots: { index: false, follow: true },
}

// Shown for any URL that does not exist. Until now every mistyped address
// returned the "coming soon" placeholder with an HTTP 200, which told both
// visitors and search engines that a page was on its way when it never was.
const routes = [
  { href: '/', label: 'Home', description: 'Start again from the beginning', icon: Home },
  { href: '/events', label: 'Events', description: 'What is coming up', icon: Calendar },
  { href: '/directory', label: 'Business Directory', description: 'British Indian businesses', icon: Store },
]

export default function NotFound() {
  const links = routes.filter(r => isLivePath(r.href))

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-cream px-4 py-20">
      <div className="max-w-lg w-full text-center">
        <p className="font-display text-6xl md:text-7xl font-bold text-gold-500/40 leading-none">404</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-charcoal-800 mt-4 mb-3">
          We cannot find that page
        </h1>
        <p className="text-charcoal-600 leading-relaxed mb-10">
          The link may be out of date, or the address may have a typo in it. Nothing is broken, and everything else
          on the site is working normally.
        </p>

        <div className="grid gap-2 text-left mb-8">
          {links.map(r => {
            const Icon = r.icon
            return (
              <Link
                key={r.href}
                href={r.href}
                className="flex items-center gap-3 bg-white border border-gold-200 rounded-xl px-4 py-3 hover:border-gold-400 hover:shadow-sm transition-all"
              >
                <span className="w-9 h-9 rounded-lg bg-gold-100 flex items-center justify-center shrink-0">
                  <Icon size={17} className="text-gold-600" />
                </span>
                <span className="min-w-0">
                  <span className="block text-charcoal-800 font-semibold text-sm">{r.label}</span>
                  <span className="block text-charcoal-500 text-xs">{r.description}</span>
                </span>
              </Link>
            )
          })}
        </div>

        <Link href="/" className={`${btnPrimary} px-8 py-3.5 text-base`}>
          Back to the homepage
        </Link>

        <p className="text-charcoal-500 text-sm mt-8 inline-flex items-center gap-1.5">
          <Mail size={14} />
          Think this is a mistake?{' '}
          <a href="mailto:connect@bild.ae" className="text-gold-700 font-medium hover:underline">
            connect@bild.ae
          </a>
        </p>
      </div>
    </div>
  )
}
