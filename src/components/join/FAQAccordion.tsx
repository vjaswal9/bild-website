'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const faqs = [
  {
    q: 'Who is eligible to join BILD?',
    a: 'BILD is open to individuals of Indian origin who were born or raised in the United Kingdom, identify with both British and Indian culture, and are currently residing in the UAE. Spouses and partners of British Indians who meet these criteria are also welcome.',
  },
  {
    q: 'How much does membership cost?',
    a: 'Lifetime membership is a one-off 50 AED fee: one simple payment for permanent access to all BILD events, the community directory, WhatsApp groups, and networking opportunities.',
  },
  {
    q: 'What happens after I pay?',
    a: 'After completing your payment via Stripe, our team will reach out within 48 hours to welcome you to BILD, add you to our WhatsApp community, and provide details on upcoming events.',
  },
  {
    q: 'Is my payment secure?',
    a: 'Yes. All payments are processed securely via Stripe, a globally trusted payment platform. BILD does not store any card details.',
  },
  {
    q: 'Can I get a refund?',
    a: 'As a not-for-profit community, membership fees go directly toward organising events and running the community. Refunds are not available, but if you have concerns please reach out to us directly.',
  },
  {
    q: 'Can I list my business in the BILD directory?',
    a: 'Yes. BILD members can list their businesses in our Business Directory. This is included in your membership. Contact us after joining to submit your business details.',
  },
]

export default function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-left font-semibold text-charcoal-800 hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
          >
            {faq.q}
            <ChevronDown
              size={18}
              className={cn('shrink-0 text-saffron-500 transition-transform', open === i && 'rotate-180')}
            />
          </button>
          {open === i && (
            <div className="px-6 pb-4 text-charcoal-600 text-sm leading-relaxed border-t border-gray-100">
              <p className="pt-4">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
