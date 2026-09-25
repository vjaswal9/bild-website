import PageHero from '@/components/ui/PageHero'
import { supabaseAdmin } from '@/lib/supabase-admin'
import PayButton from '@/components/directory/PayButton'
import { LISTING_MEMBER_FEE_AED, LISTING_NON_MEMBER_FEE_AED } from '@/lib/featured-copy'

export const dynamic = 'force-dynamic'

function InfoState({ title, message }: { title: string; message: string }) {
  return (
    <>
      <PageHero title="Activate Your Listing" subtitle="BILD Business Directory" />
      <div className="py-20 max-w-xl mx-auto px-4 text-center">
        <h2 className="font-display text-2xl font-bold text-charcoal-800 mb-4">{title}</h2>
        <p className="text-charcoal-600">{message}</p>
        <p className="text-charcoal-400 text-sm mt-6">
          Need help? Email <a href="mailto:connect@bild.ae" className="text-gold-600">connect@bild.ae</a>
        </p>
      </div>
    </>
  )
}

export default async function ListingPayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('business_name, is_bild_member, listing_paid_until, listing_payment_token_expires_at, listing_fee_exempt')
    .eq('listing_payment_token', token)
    .maybeSingle()

  if (!biz) {
    return <InfoState title="Invalid link" message="This activation link isn't valid. Please check the link from your approval email, or contact us for a new one." />
  }

  if (biz.listing_fee_exempt || (biz.listing_paid_until && new Date(biz.listing_paid_until) >= new Date())) {
    return <InfoState title="Already active" message="Your listing is already live in the BILD Business Directory - no payment needed." />
  }

  if (biz.listing_payment_token_expires_at && new Date(biz.listing_payment_token_expires_at) < new Date()) {
    return <InfoState title="Link expired" message="This activation link has expired. Please contact us and we'll send you a new one." />
  }

  const feeAed = biz.is_bild_member ? LISTING_MEMBER_FEE_AED : LISTING_NON_MEMBER_FEE_AED

  return (
    <>
      <PageHero title="Activate Your Listing" subtitle={`BILD Business Directory - ${biz.business_name}`} />
      <div className="py-16">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-charcoal-800 rounded-2xl p-8 mb-8">
            <p className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-2">Annual Listing Fee</p>
            <p className="text-white font-display text-5xl font-bold">{feeAed} <span className="text-2xl">AED</span></p>
            <p className="text-gray-400 text-sm mt-2">Per year. Secure payment via Stripe.</p>
          </div>
          <p className="text-charcoal-600 mb-8">
            Your listing for <strong>{biz.business_name}</strong> is approved and ready to go live. Complete payment below to activate it in the directory.
          </p>
          <PayButton token={token} checkoutUrl="/api/business/listing-checkout" label={`Pay ${feeAed} AED & Activate`} />
        </div>
      </div>
    </>
  )
}
