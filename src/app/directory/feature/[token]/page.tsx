import PageHero from '@/components/ui/PageHero'
import { supabaseAdmin } from '@/lib/supabase-admin'
import PayButton from '@/components/directory/PayButton'
import { FEATURED_MEMBER_FEE_AED, FEATURED_NON_MEMBER_FEE_AED, FEATURED_BENEFITS } from '@/lib/featured-copy'
import { Check } from 'lucide-react'

export const dynamic = 'force-dynamic'

function InfoState({ title, message }: { title: string; message: string }) {
  return (
    <>
      <PageHero title="Get Featured" subtitle="BILD Business Directory" />
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

export default async function FeaturePayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('business_name, is_bild_member, status')
    .eq('featured_payment_token', token)
    .maybeSingle()

  if (!biz) {
    return <InfoState title="Invalid link" message="This link isn't valid. Please use the 'Become Featured' link from your confirmation email, or contact us for a new one." />
  }

  if (biz.status !== 'approved') {
    return <InfoState title="Not yet available" message="Your listing needs to be approved and live before you can upgrade to Featured." />
  }

  const feeAed = biz.is_bild_member ? FEATURED_MEMBER_FEE_AED : FEATURED_NON_MEMBER_FEE_AED

  return (
    <>
      <PageHero title="Get Featured" subtitle={`BILD Business Directory - ${biz.business_name}`} />
      <div className="py-16">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-charcoal-800 rounded-2xl p-8 mb-8">
            <p className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-2">Featured Placement</p>
            <p className="text-white font-display text-5xl font-bold">{feeAed} <span className="text-2xl">AED</span></p>
            <p className="text-gray-400 text-sm mt-2">Per quarter (3 months). Secure payment via Stripe.</p>
          </div>
          <ul className="text-left space-y-3 mb-8 max-w-md mx-auto">
            {FEATURED_BENEFITS.map(b => (
              <li key={b} className="flex items-start gap-2 text-charcoal-600">
                <Check size={18} className="text-gold-500 shrink-0 mt-0.5" /> {b}
              </li>
            ))}
          </ul>
          <PayButton token={token} checkoutUrl="/api/business/featured-checkout" label={`Pay ${feeAed} AED & Get Featured`} />
          <p className="text-charcoal-400 text-xs mt-6">
            After payment, we&apos;ll email you a private link to add your extended bio, photos, video, and multiple offers to your profile.
          </p>
        </div>
      </div>
    </>
  )
}
