import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNav from '@/components/admin/AdminNav'
import MilestonesAdmin from './MilestonesAdmin'
import type { Milestone } from '@/lib/milestones'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminMilestonesPage() {
  // Admin sees hidden entries too, so this reads every row rather than only
  // the published ones the About page uses.
  const { data, error } = await supabaseAdmin
    .from('milestones')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    return (
      <div className="min-h-screen bg-charcoal-900">
        <AdminNav subtitle="Milestones" />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-white mb-3">Milestones are not set up yet</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Run <code className="text-gold-400">supabase/milestones-and-booking-edits.sql</code> in the Supabase SQL
            editor, then reload this page.
          </p>
          <p className="text-gray-600 text-xs mt-4">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Milestones" />
      <MilestonesAdmin milestones={(data as Milestone[]) || []} />
    </div>
  )
}
