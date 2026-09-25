import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const metadata: Metadata = {
  title: 'Booking Confirmed',
  robots: { index: false, follow: true },
}

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function EventSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string }
}) {
  const sessionId = searchParams.session_id
  type Reg = { first_name: string; ticket_name: string | null; email: string; event_id: string }
  let reg: Reg | null = null
  let eventTitle = ''
  let eventSlug = ''

  if (sessionId) {
    const { data } = await supabaseAdmin
      .from('event_registrations')
      .select('first_name, ticket_name, email, event_id')
      .eq('stripe_session_id', sessionId)
      .maybeSingle()
    reg = (data as Reg | null) ?? null
    if (reg) {
      const { data: ev } = await supabaseAdmin
        .from('events')
        .select('title, slug')
        .eq('id', reg.event_id)
        .maybeSingle()
      eventTitle = (ev as { title?: string } | null)?.title || ''
      eventSlug = (ev as { slug?: string } | null)?.slug || ''
    }
  }

  return (
    <div className="py-20">
      <div className="max-w-lg mx-auto px-4 text-center">
        <CheckCircle size={64} className="text-green-500 mx-auto mb-6" />
        <h1 className="font-display text-3xl font-bold text-charcoal-800 mb-3">You&rsquo;re registered!</h1>
        {reg ? (
          <>
            <p className="text-charcoal-600 mb-2">
              Thanks {reg.first_name} - your spot for{' '}
              <span className="font-semibold">{eventTitle}</span> is confirmed.
            </p>
            {reg.ticket_name && (
              <p className="text-charcoal-600 mb-2">
                Ticket: <span className="font-semibold">{reg.ticket_name}</span>
              </p>
            )}
            <p className="text-charcoal-500 text-sm mb-2">
              A confirmation has been sent to {reg.email}. See you there!
            </p>
            <p className="text-charcoal-500 text-sm mb-8">
              Nothing in your inbox, or need to change something? Email{' '}
              <a href="mailto:events@bild.ae" className="text-gold-600 hover:underline">events@bild.ae</a>.
            </p>
          </>
        ) : (
          <p className="text-charcoal-600 mb-8">
            Your payment was received. A confirmation email is on its way. If it does not arrive, email{' '}
            <a href="mailto:events@bild.ae" className="text-gold-600 hover:underline">events@bild.ae</a>.
          </p>
        )}
        <div className="flex gap-3 justify-center">
          {eventSlug && (
            <Link href={`/events/${eventSlug}`} className="px-6 py-3 rounded-xl border-2 border-charcoal-700 text-charcoal-700 font-semibold hover:bg-charcoal-700 hover:text-white transition-all">
              View event
            </Link>
          )}
          <Link href="/events" className="px-6 py-3 rounded-xl bg-gold-500 text-white font-semibold hover:bg-gold-600 transition-colors">
            All events
          </Link>
        </div>
      </div>
    </div>
  )
}
