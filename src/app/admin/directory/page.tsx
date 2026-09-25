import { supabaseAdmin, BusinessSubmission } from '@/lib/supabase-admin'
import AdminDashboard from '../AdminDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { data, error } = await supabaseAdmin
    .from('business_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="min-h-screen bg-charcoal-900 flex items-center justify-center text-white">
        <p>Error loading submissions: {error.message}</p>
      </div>
    )
  }

  // Only actually-paid members count as "verified" - used to flag a business
  // submission that claims BILD membership but doesn't match anyone here.
  const { data: members } = await supabaseAdmin
    .from('members')
    .select('email, phone')
    .eq('status', 'paid')

  return <AdminDashboard submissions={(data as BusinessSubmission[]) || []} members={members || []} />
}
