import AdminNav from '@/components/admin/AdminNav'
import { googleReviewsInviteRecipients } from '@/lib/google-reviews-link'
import InviteClient from './InviteClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function GoogleReviewsInvitePage() {
  const { recipients, alreadyActive } = await googleReviewsInviteRecipients()
  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Directory · Google reviews invitation" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <InviteClient recipients={recipients} alreadyActive={alreadyActive} />
      </div>
    </div>
  )
}
