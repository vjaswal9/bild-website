'use client'

import { ELIGIBILITY_SUMMARY } from '@/lib/eligibility'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const faqs = [
  {
    q: 'Who is eligible to join BILD?',
    a: ELIGIBILITY_SUMMARY,
  },
  {
    q: 'How much does membership cost?',
    a: 'Membership is a one-off 50 AED fee: one simple payment for access to all BILD events, the community directory, WhatsApp groups, and networking opportunities.',
  },
  {
    q: 'What happens after I sign up?',
    a: 'Once you complete the sign-up form, our team will reach out within 48 hours to welcome you to BILD, arrange your one-off membership fee, add you to our WhatsApp community, and share details on upcoming events.',
  },
  {
    q: 'Is my information secure?',
    a: 'Yes. Your details are handled securely and used only to manage your BILD membership. We never sell or share your information with third parties.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Membership fees go directly toward organising events and running the network. Refunds are not available, but if you have concerns please reach out to us directly.',
  },
  {
    q: 'Can I list my business in the BILD directory?',
    a: 'Yes. BILD members can list their businesses in our Business Directory at a discounted member rate. Non-BILD businesses are also welcome to list, at a standard rate.',
  },
]

export default function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(faq => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: { '@type': 'Answer', text: faq.a },
            })),
          }),
        }}
      />
      {faqs.map((faq, i) => (
        <div key={i} className="border border-gold-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-left font-semibold text-charcoal-800 hover:bg-gold-50 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            {faq.q}
            <ChevronDown
              size={18}
              className={cn('shrink-0 text-gold-500 transition-transform', open === i && 'rotate-180')}
            />
          </button>
          <div
            className={cn(
              'grid transition-all duration-300 ease-in-out',
              open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}
          >
            <div className="overflow-hidden">
              <div className="px-6 pb-4 text-charcoal-600 text-sm leading-relaxed border-t border-gold-100">
                <p className="pt-4">{faq.a}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
