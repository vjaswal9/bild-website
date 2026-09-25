import PageHero from '@/components/ui/PageHero'
import { supabaseAdmin } from '@/lib/supabase-admin'
import FeaturedContentForm from '@/components/directory/FeaturedContentForm'
import StatsPanel from '@/components/directory/StatsPanel'
import { statsForBusiness } from '@/lib/directory-stats'
import BusinessTestimonialsForm, { type OwnTestimonial } from '@/components/directory/BusinessTestimonialsForm'

export const dynamic = 'force-dynamic'

function InfoState({ title, message }: { title: string; message: string }) {
  return (
    <>
      <PageHero title="Manage Your Listing" subtitle="BILD Business Directory" />
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

// The page a business manages its own listing from.
//
// It used to be Featured-only, because Featured content was all it held. It
// now also carries the customer testimonials form, which every approved
// business may use, so the page opens for any approved listing and only the
// Featured section is gated.
export default async function ManageListingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, status, delisted_at, featured, featured_paid_until, featured_bio, featured_gallery_urls, featured_video_url, featured_offers, featured_brochure_url, featured_brochure_name, profile_view_count')
    .eq('featured_manage_token', token)
    .maybeSingle()

  if (!biz) {
    return <InfoState title="Invalid link" message="This link isn't valid. Please use the link from your BILD email, or contact us for a new one." />
  }
  if (biz.status !== 'approved' || biz.delisted_at) {
    return <InfoState title="Listing not live" message="This listing is not currently live in the directory, so there is nothing to manage. Contact us if you think that is wrong." />
  }

  const featuredActive = !!biz.featured && (biz.featured_paid_until == null || new Date(biz.featured_paid_until) >= new Date())

  // Shown to every approved listing, not just Featured. A standard listing
  // sees its own view count with the click breakdown locked - the upgrade is
  // argued with the business's own numbers rather than a generic claim.
  // A failure here must not take the whole manage page down with it.
  const stats = await statsForBusiness(biz.id).catch(() => null)

  const { data: testimonialRows } = await supabaseAdmin
    .from('business_testimonials')
    .select('id, customer_name, quote, status, decline_reason, created_at')
    .eq('business_id', biz.id)
    .order('created_at', { ascending: false })

  return (
    <>
      <PageHero title="Manage Your Listing" subtitle={`BILD Business Directory - ${biz.business_name}`} />
      <div className="py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

          {stats && (
            <StatsPanel
              isFeatured={featuredActive}
              last30={stats.last30}
              prev30={stats.prev30}
              // The legacy column stopped incrementing when the profile page became
              // cached, so it is a frozen historical figure. Adding the two gives a
              // total that keeps growing rather than appearing to stall.
              allTime={{ ...stats.allTime, view: (stats.allTime.view || 0) + (biz.profile_view_count || 0) }}
              daily={stats.daily}
            />
          )}

          <BusinessTestimonialsForm
            token={token}
            initial={(testimonialRows || []) as OwnTestimonial[]}
          />

          {featuredActive ? (
            <FeaturedContentForm
              token={token}
              initialBio={biz.featured_bio || ''}
              initialGallery={biz.featured_gallery_urls || []}
              initialVideoUrl={biz.featured_video_url || ''}
              initialOffers={biz.featured_offers?.length ? biz.featured_offers : ['']}
              viewCount={biz.profile_view_count || 0}
              initialBrochureUrl={biz.featured_brochure_url || ''}
              initialBrochureName={biz.featured_brochure_name || ''}
            />
          ) : (
            <div className="bg-cream border border-gold-200 rounded-2xl p-6">
              <h2 className="font-display text-xl font-bold text-charcoal-800">Featured content</h2>
              <p className="text-sm text-charcoal-500 mt-1">
                {biz.featured_paid_until
                  ? 'Your Featured placement has lapsed. Everything you added before is saved and reappears the moment you renew.'
                  : 'Featured listings can add a longer bio, a photo gallery, a video, member offers and a downloadable brochure.'}
              </p>
              <a href="/directory/get-featured" className="inline-block mt-4 text-gold-600 font-semibold text-sm hover:underline">
                See what Featured includes &rarr;
              </a>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
