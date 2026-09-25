import type { Metadata } from 'next'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadge from '@/components/ui/GoogleRatingBadge'
import KnowledgeBaseClient from './KnowledgeBaseClient'
import kb from '@/data/knowledge-base.json'
import { getGoogleReviews } from '@/lib/google-reviews'

// Regenerated on the same timer as every other page that shows the Google
// rating badge. Left fully static, these pages froze their review count at
// deploy time while the homepage moved on, so two pages could show a
// different number of reviews on the same day.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Knowledge Base',
  description: 'Trusted recommendations from the BILD community - tradespeople, doctors, restaurants, services and more.',
}

export default async function KnowledgeBasePage() {
  const googleReviews = await getGoogleReviews()

  return (
    <>
      <PageHero
        title="Community Knowledge Base"
        subtitle="The BILD little black book: trusted recommendations shared by our members, all in one place."
      >
        {googleReviews && (
          <GoogleRatingBadge rating={googleReviews.rating} totalReviews={googleReviews.totalReviews} mapsUrl={googleReviews.mapsUrl} />
        )}
      </PageHero>
      <KnowledgeBaseClient categories={kb.categories} entries={kb.entries} />
    </>
  )
}
