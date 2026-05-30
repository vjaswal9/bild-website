import Link from 'next/link'
import { Mail } from 'lucide-react'
import { FaInstagram, FaFacebookF, FaLinkedinIn } from 'react-icons/fa'
import { SITE_CONFIG } from '@/data/config'

const navLinks = [
  { href: '/about', label: 'About BILD' },
  { href: '/events', label: 'Events' },
  { href: '/photo-vault', label: 'Photo Vault' },
  { href: '/directory', label: 'Business Directory' },
  { href: '/join', label: 'Join BILD' },
  { href: '/community-rules', label: 'Community Rules' },
  { href: '/terms', label: 'Terms & Conditions' },
]

export default function Footer() {
  return (
    <footer className="bg-charcoal-800 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <p className="font-display text-3xl font-bold text-white mb-1">
            <span className="text-gold-400">BILD</span>
          </p>
          <p className="text-sm text-gray-400 mb-4">British Indians Living in Dubai</p>
          <p className="text-sm leading-relaxed text-gray-400">
            A not-for-profit community connecting British Indians in the UAE through culture, connection, and commerce.
          </p>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Quick Links</h3>
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-gray-400 hover:text-saffron-400 transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Connect</h3>
          <a
            href={`mailto:${SITE_CONFIG.contactEmail}`}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-saffron-400 transition-colors mb-6"
          >
            <Mail size={16} />
            {SITE_CONFIG.contactEmail}
          </a>
          <div className="flex gap-4">
            <a
              href={SITE_CONFIG.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-charcoal-700 flex items-center justify-center text-gray-400 hover:bg-saffron-500 hover:text-white transition-all"
              aria-label="Instagram"
            >
              <FaInstagram size={18} />
            </a>
            <a
              href={SITE_CONFIG.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-charcoal-700 flex items-center justify-center text-gray-400 hover:bg-saffron-500 hover:text-white transition-all"
              aria-label="Facebook"
            >
              <FaFacebookF size={18} />
            </a>
            <a
              href={SITE_CONFIG.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-charcoal-700 flex items-center justify-center text-gray-400 hover:bg-saffron-500 hover:text-white transition-all"
              aria-label="LinkedIn"
            >
              <FaLinkedinIn size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-charcoal-700 py-5 text-center text-xs text-gray-500">
        <p>© {new Date().getFullYear()} BILD. British Indians Living in Dubai. All rights reserved.</p>
        <p className="mt-1">A not-for-profit community organisation. Registered in UAE.</p>
      </div>
    </footer>
  )
}
