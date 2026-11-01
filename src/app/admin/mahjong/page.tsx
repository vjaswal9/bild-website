import AdminNav from '@/components/admin/AdminNav'
import { readMahjongInterest } from '@/lib/mahjong-admin'
import MahjongAdmin from './MahjongAdmin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminMahjongPage() {
  let rows: Awaited<ReturnType<typeof readMahjongInterest>> = []
  let problem = ''
  try {
    rows = await readMahjongInterest()
  } catch (e) {
    problem = e instanceof Error ? e.message : 'The list could not be read.'
  }

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Mahjong interest" />
      <MahjongAdmin initial={rows} problem={problem} />
    </div>
  )
}
