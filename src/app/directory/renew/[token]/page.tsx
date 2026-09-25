import PageHero from '@/components/ui/PageHero'
import { supabaseAdmin } from '@/lib/supabase-admin'
import RenewalForm from './RenewalForm'

export const dynamic = 'force-dynamic'

function InfoState({ title, message }: { title: string; message: string }) {
  return (
    <>
      <PageHero title="Renew Your Document" subtitle="BILD Business Directory" />
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

export default async function RenewLicensePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, business_country, renewal_token_expires_at, pending_renewal_submitted_at')
    .eq('renewal_token', token)
    .maybeSingle()

  if (!biz) {
    return (
      <InfoState
        title="Invalid link"
        message="This renewal link isn't valid. Please check the link from your reminder email, or contact us for a new one."
      />
    )
  }

  if (biz.renewal_token_expires_at && new Date(biz.renewal_token_expires_at) < new Date()) {
    return (
      <InfoState
        title="Link expired"
        message="This renewal link has expired. Please contact us and we'll send you a new one."
      />
    )
  }

  if (biz.pending_renewal_submitted_at) {
    return (
      <InfoState
        title="Renewal already submitted"
        message="We've received your renewed document and it's awaiting review by our team. We'll be in touch shortly."
      />
    )
  }

  return (
    <>
      <PageHero title="Renew Your Document" subtitle={`BILD Business Directory - ${biz.business_name}`} />
      <div className="py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <RenewalForm token={token} businessName={biz.business_name} country={biz.business_country === 'UK' ? 'UK' : 'UAE'} />
        </div>
      </div>
    </>
  )
}
