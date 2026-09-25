import AdminNav from '@/components/admin/AdminNav'
import EmailsAdmin from './EmailsAdmin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default function AdminEmailsPage() {
  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Emails" />
      <EmailsAdmin />
    </div>
  )
}
