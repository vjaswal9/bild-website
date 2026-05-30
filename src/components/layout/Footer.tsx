import Link from 'next/link'
import { Share2, ExternalLink, Link2, Mail, MessageCircle } from 'lucide-react'
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
          <p className="font-display text-2xl font-bold text-white mb-1">
            <span className="text-saffron-400">BILD</span>
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
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-saffron-400 transition-colors mb-4"
          >
            <Mail size={16} />
            {SITE_CONFIG.contactEmail}
          </a>
          <div className="flex gap-4">
            {SITE_CONFIG.whatsappGroupLink !== 'REPLACE_ME_WHATSAPP_LINK' && (
              <a href={SITE_CONFIG.whatsappGroupLink} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-green-400 transition-colors" aria-label="WhatsApp">
                <MessageCircle size={20} />
              </a>
            )}
            <a href={SITE_CONFIG.instagramUrl} target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-saffron-400 transition-colors" aria-label="Instagram">
              <Share2 size={20} />
            </a>
            <a href={SITE_CONFIG.facebookUrl} target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-saffron-400 transition-colors" aria-label="Facebook">
              <ExternalLink size={20} />
            </a>
            <a href={SITE_CONFIG.linkedinUrl} target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-saffron-400 transition-colors" aria-label="LinkedIn">
              <Link2 size={20} />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-charcoal-700 py-5 text-center text-xs text-gray-500">
        <p>© {new Date().getFullYear()} BILD — British Indians Living in Dubai. All rights reserved.</p>
        <p className="mt-1">A not-for-profit community organisation. Registered in UAE.</p>
      </div>
    </footer>
  )
}
