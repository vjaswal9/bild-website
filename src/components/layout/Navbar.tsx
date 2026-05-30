'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SITE_CONFIG } from '@/data/config'

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/events', label: 'Events' },
  { href: '/photo-vault', label: 'Photo Vault' },
  { href: '/directory', label: 'Directory' },
  { href: '/community-rules', label: 'Community Rules' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm' : 'bg-white'
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl text-charcoal-800">
          <span className="text-saffron-500">BILD</span>
          <span className="hidden sm:inline text-sm font-sans font-normal text-charcoal-600">
            British Indians Living in Dubai
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'text-saffron-600'
                  : 'text-charcoal-600 hover:text-charcoal-900'
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/join"
            className="ml-2 bg-saffron-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-saffron-600 transition-colors"
          >
            Join BILD
          </Link>
        </div>

        <button
          className="lg:hidden p-2 rounded-md text-charcoal-700"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="lg:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                'py-2 text-base font-medium',
                pathname === link.href ? 'text-saffron-600' : 'text-charcoal-700'
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/join"
            onClick={() => setOpen(false)}
            className="mt-2 bg-saffron-500 text-white px-4 py-2.5 rounded-lg text-base font-semibold text-center hover:bg-saffron-600 transition-colors"
          >
            Join BILD
          </Link>
        </div>
      )}
    </header>
  )
}
