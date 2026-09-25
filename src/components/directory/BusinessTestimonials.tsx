import { Quote } from 'lucide-react'
import { supabaseRead } from '@/lib/supabase-admin'

// How many are on the page before the rest are folded away. Four fills two
// rows on a desktop without pushing the rest of the profile off the screen.
const SHOWN_AT_FIRST = 4

// Testimonials a business collected from its own customers, shown on its
// profile page once an admin has approved them.
//
// Renders nothing at all when there are none, rather than an empty heading:
// a "Testimonials" section with nothing under it reads worse than no section.
//
// Deliberately selects only the customer name and the quote. The proof
// screenshot behind each one is a customer's private message and must never
// reach a public page, so it is not fetched here at all.
export default async function BusinessTestimonials({
  businessId,
  businessName,
}: {
  businessId: string
  businessName: string
}) {
  const { data, error } = await supabaseRead
    .from('business_testimonials')
    .select('id, customer_name, quote')
    .eq('business_id', businessId)
    .eq('status', 'approved')
    // Higher than the four shown up front, because the rest are folded away
    // and cost nothing until someone opens them.
    .order('created_at', { ascending: false })
    .limit(24)

  // A failed read hides the section rather than breaking the profile page.
  if (error) {
    console.error('Could not load testimonials for a business profile:', error)
    return null
  }
  const items = data || []
  if (items.length === 0) return null

  const first = items.slice(0, SHOWN_AT_FIRST)
  const rest = items.slice(SHOWN_AT_FIRST)

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-1">
        What their customers say
      </h2>
      <p className="text-charcoal-500 text-sm mb-6">
        {items.length === 1
          ? `A testimonial ${businessName} received from their own customer, checked by BILD.`
          : `Testimonials ${businessName} received from their own customers, checked by BILD.`}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {first.map(t => <Card key={t.id} quote={t.quote} name={t.customer_name} />)}
      </div>

      {/* A details element rather than a client component: the rest of this
          page ships no JavaScript, and expanding a list is something HTML has
          done on its own for years. It is keyboard accessible for free. */}
      {rest.length > 0 && (
        <details className="bt-more mt-4">
          <summary className="bt-more-toggle inline-flex items-center gap-1.5 cursor-pointer select-none rounded-xl border border-gold-300 px-4 py-2.5 text-sm font-semibold text-gold-700 hover:bg-gold-500/10 transition-colors">
            <span className="bt-more-show">Show all {items.length} testimonials</span>
            <span className="bt-more-less">Show fewer</span>
          </summary>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            {rest.map(t => <Card key={t.id} quote={t.quote} name={t.customer_name} />)}
          </div>
        </details>
      )}
    </section>
  )
}

function Card({ quote, name }: { quote: string; name: string }) {
  return (
    <figure className="bg-cream border border-gold-200 rounded-2xl p-5 shadow-card flex flex-col">
      <Quote size={22} className="text-gold-300 mb-2 shrink-0" aria-hidden="true" />
      <blockquote className="text-charcoal-700 leading-relaxed flex-1">{quote}</blockquote>
      <figcaption className="mt-4 pt-3 border-t border-gold-100 text-sm font-semibold text-charcoal-800">
        {name}
      </figcaption>
    </figure>
  )
}
