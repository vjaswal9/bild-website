'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Store, Users, PartyPopper, KeyRound, LogOut, Images, Quote, LineChart, Milestone, Mail, BadgeCheck } from 'lucide-react'

const links = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/money', label: 'Money', icon: LineChart },
  { href: '/admin/directory', label: 'Directory', icon: Store },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/events', label: 'Events', icon: PartyPopper },
  { href: '/admin/faces', label: 'Faces', icon: Images },
  { href: '/admin/milestones', label: 'Milestones', icon: Milestone },
  { href: '/admin/testimonials', label: 'BILD Testimonials', icon: Quote },
  { href: '/admin/business-testimonials', label: 'Biz Testimonials', icon: BadgeCheck },
  { href: '/admin/emails', label: 'Emails', icon: Mail },
  { href: '/admin/security', label: 'Security', icon: KeyRound },
]

// Shared admin header: logo goes home to the dashboard, plus a nav menu.
export default function AdminNav({ subtitle }: { subtitle?: string }) {
  const pathname = usePathname()

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <header className="bg-charcoal-800 border-b border-charcoal-700 px-4 sm:px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <Link href="/admin" className="flex items-center gap-3 shrink-0" title="Back to dashboard">
          <Image src="/bild-logo-new.svg" alt="BILD" width={64} height={40} className="h-9 w-auto object-contain brightness-0 invert" />
          <div>
            <p className="font-display font-bold text-white leading-tight">BILD Admin</p>
            {subtitle && <p className="text-gray-400 text-xs">{subtitle}</p>}
          </div>
        </Link>

        <nav className="flex items-center gap-1 flex-wrap">
          {links.map(l => {
            const Icon = l.icon
            const active = l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-white hover:bg-charcoal-700'
                }`}
              >
                <Icon size={17} strokeWidth={1.9} /> {l.label}
              </Link>
            )
          })}
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-charcoal-700 transition-colors"
          >
            <LogOut size={15} /> Sign out
          </button>
        </nav>
      </div>
    </header>
  )
}
