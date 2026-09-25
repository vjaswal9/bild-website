import { supabaseAdmin } from '@/lib/supabase-admin'
import MembersTable, { type Member } from './MembersTable'
import AdminNav from '@/components/admin/AdminNav'
import { recoveryOf } from '@/lib/member-recovery'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminMembersPage() {
  const { data } = await supabaseAdmin
    .from('members')
    .select('id, created_at, full_name, email, phone, gender, location, status, paid_at, invite_token, invite_opened_at, invite_used_at, abandoned_reminder_sent_at')
    .order('created_at', { ascending: false })

  const members = (data as Member[]) || []
  const paid = members.filter(m => m.status === 'paid')
  const abandoned = members.filter(m => m.status === 'pending')
  // Started, left without paying, and came back later to pay.
  const recovered = members.filter(m => recoveryOf(m)).length

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle={`Members · ${paid.length} paid of ${members.length} · ${abandoned.length} abandoned · ${recovered} recovered`} />

      <div className="max-w-6xl mx-auto px-4 pt-6 flex justify-end">
        <a href="/api/admin/members/export" className="bg-gold-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-600">
          Download Excel
        </a>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {members.length === 0 ? (
          <p className="text-gray-500 text-center py-20">No members yet.</p>
        ) : (
          <MembersTable members={members} />
        )}
      </div>
    </div>
  )
}
