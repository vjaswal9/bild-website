import { Check } from 'lucide-react'
import { SITE_CONFIG } from '@/data/config'
import ScrollToFormButton from './ScrollToFormButton'

const benefits = [
  'Access to all BILD events and celebrations',
  'Listed in our member network',
  'Early access to event tickets',
  'Business directory listing (for business owners)',
  'WhatsApp community group access',
  'Networking with British Indians across UAE',
  'Family-friendly events included',
  'Support from a trusted British Indian community',
]

export default function MembershipCard() {
  return (
    <div className="max-w-md mx-auto bg-gold-50 rounded-2xl shadow-xl border border-gold-100 overflow-hidden">
      <div className="bg-charcoal-800 p-8 text-center">
        <p className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-2">Lifetime Membership</p>
        <div className="flex items-end justify-center gap-1">
          <span className="text-white font-display text-6xl font-bold">{SITE_CONFIG.membershipFeeAED}</span>
          <span className="text-gray-300 text-xl mb-2">AED</span>
        </div>
        <p className="text-gray-400 text-sm mt-2">One simple fee. Lifetime community access.</p>
      </div>

      <div className="p-8">
        <ul className="space-y-3 mb-8">
          {benefits.map(benefit => (
            <li key={benefit} className="flex items-start gap-3">
              <Check size={18} className="text-gold-500 shrink-0 mt-0.5" />
              <span className="text-charcoal-600 text-sm">{benefit}</span>
            </li>
          ))}
        </ul>

        <ScrollToFormButton />

        <p className="text-xs text-center text-gray-400 mt-4">
          Eligible applicants pay the one-off 50 AED and get their WhatsApp group invite instantly.
        </p>
      </div>
    </div>
  )
}
