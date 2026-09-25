'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { FaInstagram, FaFacebookF, FaLinkedinIn } from 'react-icons/fa'
import { cn } from '@/lib/utils'
import { SITE_CONFIG } from '@/data/config'
import { isLivePath } from '@/lib/launch'
import { btnPrimary } from '@/lib/ui'

type NavLink = { href: string; label: string; emphasis?: boolean }

const allLinks: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  // Promoted ahead of the community pages: the directory is a paid product with
  // its own audience, and it was previously sixth in a list of seven.
  { href: '/directory', label: 'Business Directory', emphasis: true },
  { href: '/photo-vault', label: 'Photo Vault' },
  { href: '/faces-of-bild', label: 'Faces of BILD' },
  { href: '/knowledge-base', label: 'Knowledge Base' },
  { href: '/about', label: 'About' },
]

// During soft launch, only show links to pages that are actually live.
const links = allLinks.filter((l) => isLivePath(l.href))

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const hideJoinButton = pathname === '/directory'

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
      <nav
        className={cn(
          'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6 xl:gap-10 transition-all duration-300',
          scrolled ? 'h-16 md:h-[72px]' : 'h-20 md:h-24'
        )}
      >
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <Image
            src="/bild-logo-new.svg"
            alt="BILD"
            width={100}
            height={63}
            className={cn(
              'w-auto object-contain transition-all duration-300',
              scrolled ? 'h-12 md:h-14' : 'h-16 md:h-[84px]'
            )}
          />
          <span className="hidden sm:inline lg:hidden xl:inline text-sm font-sans font-normal text-charcoal-600 whitespace-nowrap leading-snug">
            British Indians Living in Dubai
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-5 xl:gap-6 shrink-0">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative text-sm transition-colors pb-1 whitespace-nowrap',
                link.emphasis ? 'font-semibold' : 'font-medium',
                pathname === link.href
                  ? 'text-gold-500'
                  : link.emphasis
                    ? 'text-charcoal-800 hover:text-gold-600'
                    : 'text-charcoal-600 hover:text-charcoal-900'
              )}
            >
              {link.label}
              {pathname === link.href && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500 rounded-full" />
              )}
            </Link>
          ))}
          <Link href="/directory/submit" className={`${btnPrimary} ml-2 px-4 py-2 text-sm`}>
            List Your Business
          </Link>
          {!hideJoinButton && (
            <Link href="/join" className={`${btnPrimary} px-4 py-2 text-sm`}>
              Join BILD ⭐
            </Link>
          )}
        </div>

        <button
          className="lg:hidden p-2 rounded-lg text-charcoal-700"
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
                'py-2 text-base border-l-2 pl-3',
                link.emphasis ? 'font-semibold' : 'font-medium',
                pathname === link.href
                  ? 'text-gold-600 border-gold-500'
                  : 'text-charcoal-700 border-transparent'
              )}
            >
              {link.label}
            </Link>
          ))}
          {!hideJoinButton && (
            <Link
              href="/join"
              onClick={() => setOpen(false)}
              className={`${btnPrimary} mt-2 px-4 py-2.5 text-base`}
            >
              Join BILD ⭐
            </Link>
          )}
          <Link
            href="/directory/submit"
            onClick={() => setOpen(false)}
            className={`${btnPrimary} px-4 py-2.5 text-base`}
          >
            List Your Business
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
