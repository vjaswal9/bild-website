'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FAQItem = { q: string; a: string }

// Generic FAQ accordion + FAQPage schema - same pattern as
// src/components/join/FAQAccordion.tsx, reusable on any page so structured
// Q&A content (good for both real visitors and AI answer engines) isn't
// confined to a single page.
export default function FAQSection({ faqs }: { faqs: FAQItem[] }) {
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
