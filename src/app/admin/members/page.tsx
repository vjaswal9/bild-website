import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type Member = {
  id: string
  created_at: string
  full_name: string
  email: string
  phone: string | null
  gender: string | null
  location: string | null
  status: string
  paid_at: string | null
}

export default async function AdminMembersPage() {
  const { data } = await supabaseAdmin
    .from('members')
    .select('id, created_at, full_name, email, phone, gender, location, status, paid_at')
    .order('created_at', { ascending: false })

  const members = (data as Member[]) || []
  const paid = members.filter(m => m.status === 'paid')

  return (
    <div className="min-h-screen bg-charcoal-900">
      <header className="bg-charcoal-800 border-b border-charcoal-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-white text-lg">BILD Members</h1>
          <p className="text-gray-400 text-xs">{paid.length} paid · {members.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-white">← Directory admin</Link>
          <a href="/api/admin/members/export" className="bg-gold-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-600">
            Download Excel
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {members.length === 0 ? (
          <p className="text-gray-500 text-center py-20">No members yet.</p>
        ) : (
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-charcoal-700">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Gender</th>
                  <th className="px-5 py-3 font-medium">Emirate</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-b border-charcoal-700/60 hover:bg-charcoal-700/40">
                    <td className="px-5 py-3 text-white font-medium">{m.full_name}</td>
                    <td className="px-5 py-3 text-gray-400">{m.email}</td>
                    <td className="px-5 py-3 text-gray-400">{m.phone || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 capitalize">{m.gender || '—'}</td>
                    <td className="px-5 py-3 text-gray-400">{m.location || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${m.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{m.status}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{m.paid_at ? new Date(m.paid_at).toLocaleDateString('en-GB') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
