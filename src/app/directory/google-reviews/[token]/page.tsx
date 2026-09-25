import type { Metadata } from 'next'
import PageHero from '@/components/ui/PageHero'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyGoogleReviewsLinkToken } from '@/lib/admin-auth'
import { getGoogleReviews } from '@/lib/google-reviews'
import GoogleReviewsForm from './GoogleReviewsForm'

export const dynamic = 'force-dynamic'

// A personal page, reached from a business's own email. Never indexed.
export const metadata: Metadata = {
  title: 'Add your Google reviews',
  robots: { index: false, follow: false },
}

function InfoState({ title, message }: { title: string; message: string }) {
  return (
    <>
      <PageHero title="Add your Google reviews" subtitle="BILD Business Directory" />
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

export default async function GoogleReviewsLinkPage({ params }: { params: { token: string } }) {
  const businessId = await verifyGoogleReviewsLinkToken(params.token)
  if (!businessId) {
    return <InfoState title="This link is not valid" message="Please use the button from your BILD email, or contact us for a new one." />
  }

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, slug, status, delisted_at, google_place_id')
    .eq('id', businessId)
    .maybeSingle()

  if (!biz || biz.status !== 'approved' || biz.delisted_at) {
    return <InfoState title="Listing not live" message="This listing is not currently live in the BILD Business Directory." />
  }

  const current = biz.google_place_id ? await getGoogleReviews(biz.google_place_id) : null

  return (
    <>
      <PageHero title="Add your Google reviews" subtitle={`BILD Business Directory - ${biz.business_name}`} />
      <div className="py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {biz.google_place_id && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-sm text-charcoal-700">
              <strong className="text-charcoal-800">Google reviews are already showing on your listing.</strong>{' '}
              {current ? `${current.rating.toFixed(1)} stars from ${current.totalReviews} reviews. ` : ''}
              You only need to use this page if you want to change the Google business it is connected to.
            </div>
          )}

          <div className="bg-cream border border-gold-200 rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold text-charcoal-800 mb-3">How to find your link</h2>
            <ol className="list-decimal pl-5 space-y-2 text-charcoal-600 text-sm leading-relaxed">
              <li>Open your Google Business Profile. Search for your business name on Google while signed in, or go to business.google.com</li>
              <li>Click <strong className="text-charcoal-800">Ask for reviews</strong>. On some screens it is called <strong className="text-charcoal-800">Get more reviews</strong></li>
              <li>Copy the link it shows you. It starts with <strong className="text-charcoal-800">g.page/r/</strong></li>
              <li>Paste it below and press Connect</li>
            </ol>
            <p className="text-xs text-charcoal-500 mt-4">
              A link copied from Google search results or Google Maps will not work. If you paste one, we will tell you straight away.
            </p>
          </div>

          <GoogleReviewsForm token={params.token} businessName={biz.business_name} />
        </div>
      </div>
    </>
  )
}
