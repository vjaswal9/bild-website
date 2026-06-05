'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { FaInstagram, FaFacebookF, FaLinkedinIn } from 'react-icons/fa'
import { cn } from '@/lib/utils'
import { SITE_CONFIG } from '@/data/config'

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/events', label: 'Events' },
  { href: '/photo-vault', label: 'Photo Vault' },
  { href: '/directory', label: 'Business Directory' },
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
        scrolled ? 'bg-cream/95 backdrop-blur-sm shadow-sm' : 'bg-cream'
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/bild-logo-new.svg" alt="BILD" width={100} height={63} className="h-14 w-auto object-contain" />
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
                'relative text-sm font-medium transition-colors pb-1',
                pathname === link.href
                  ? 'text-gold-500'
                  : 'text-charcoal-600 hover:text-charcoal-900'
              )}
            >
              {link.label}
              {pathname === link.href && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500 rounded-full" />
              )}
            </Link>
          ))}
          <Link
            href="/join"
            className="ml-2 bg-gold-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-600 transition-colors"
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

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden bg-cream border-t border-gold-100 px-4 py-4 flex flex-col gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                'py-2 text-base font-medium border-l-2 pl-3',
                pathname === link.href
                  ? 'text-gold-600 border-gold-500'
                  : 'text-charcoal-700 border-transparent'
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/join"
            onClick={() => setOpen(false)}
            className="mt-2 bg-gold-500 text-white px-4 py-2.5 rounded-lg text-base font-semibold text-center hover:bg-gold-600 transition-colors"
          >
            Join BILD
          </Link>
          {/* Fix 11 social icons in mobile menu */}
          <div className="flex gap-4 pt-3 pb-1 border-t border-gold-100 mt-1">
            <a href={SITE_CONFIG.instagramUrl} target="_blank" rel="noopener noreferrer"
              className="text-charcoal-500 hover:text-gold-600 transition-colors" aria-label="Instagram">
              <FaInstagram size={20} />
            </a>
            <a href={SITE_CONFIG.facebookUrl} target="_blank" rel="noopener noreferrer"
              className="text-charcoal-500 hover:text-gold-600 transition-colors" aria-label="Facebook">
              <FaFacebookF size={20} />
            </a>
            <a href={SITE_CONFIG.linkedinUrl} target="_blank" rel="noopener noreferrer"
              className="text-charcoal-500 hover:text-gold-600 transition-colors" aria-label="LinkedIn">
              <FaLinkedinIn size={20} />
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
