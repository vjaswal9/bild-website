import PageHero from '@/components/ui/PageHero'
import { supabaseAdmin } from '@/lib/supabase-admin'
import PayButton from '@/components/directory/PayButton'

export const dynamic = 'force-dynamic'

function InfoState({ title, message }: { title: string; message: string }) {
  return (
    <>
      <PageHero title="Ticket Upgrade" subtitle="BILD Events" />
      <div className="py-20 max-w-xl mx-auto px-4 text-center">
        <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-4">{title}</h2>
        <p className="text-charcoal-600">{message}</p>
        <p className="text-charcoal-400 text-sm mt-6">
          Need help? Email <a href="mailto:events@bild.ae" className="text-gold-600">events@bild.ae</a>
        </p>
      </div>
    </>
  )
}

export default async function TicketUpgradePayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: reg } = await supabaseAdmin
    .from('event_registrations')
    .select('first_name, ticket_name, upgrade_due_aed, upgrade_payment_token_expires_at, event_id')
    .eq('upgrade_payment_token', token)
    .maybeSingle()

  if (!reg) {
    return <InfoState title="Invalid link" message="This payment link isn't valid. Please check the link from your email, or contact us for a new one." />
  }

  if (reg.upgrade_due_aed == null) {
    return <InfoState title="Already paid" message="Nothing is currently owed on this booking - if you already paid, you're all set." />
  }

  if (reg.upgrade_payment_token_expires_at && new Date(reg.upgrade_payment_token_expires_at) < new Date()) {
    return <InfoState title="Link expired" message="This payment link has expired. Please contact us and we'll send you a new one." />
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('title')
    .eq('id', reg.event_id)
    .maybeSingle()

  const amountAed = Number(reg.upgrade_due_aed)

  return (
    <>
      <PageHero title="Ticket Upgrade" subtitle={event?.title || 'BILD Events'} />
      <div className="py-16">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-charcoal-800 rounded-2xl p-8 mb-8">
            <p className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-2">Amount due</p>
            <p className="text-white font-display text-5xl font-bold">{amountAed} <span className="text-2xl">AED</span></p>
            <p className="text-gray-400 text-sm mt-2">Secure payment via Stripe.</p>
          </div>
          <p className="text-charcoal-600 mb-8">
            Hi {reg.first_name || 'there'}, your ticket{reg.ticket_name ? <> was changed to <strong>{reg.ticket_name}</strong>,</> : ' was changed,'} which
            costs more than you already paid. Complete payment below to confirm the change - your place at the event is unaffected either way.
          </p>
          <PayButton token={token} checkoutUrl="/api/events/upgrade-checkout" label={`Pay ${amountAed} AED`} />
        </div>
      </div>
    </>
  )
}
