import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNav from '@/components/admin/AdminNav'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type Row = Record<string, unknown>

const LICENSE_ALERT_DAYS = 3
const WEEKS = 8

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

// Buckets rows into WEEKS trailing 7-day windows ending today, oldest first.
function weeklyBuckets(rows: Row[], dateKey: string, valueFn: (r: Row) => number): { label: string; value: number }[] {
  const now = Date.now()
  const buckets: { label: string; value: number; start: number; end: number }[] = []
  for (let i = WEEKS - 1; i >= 0; i--) {
    const end = now - i * 7 * 24 * 60 * 60 * 1000
    const start = end - 7 * 24 * 60 * 60 * 1000
    buckets.push({
      label: new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      value: 0,
      start,
      end,
    })
  }
  for (const r of rows) {
    const t = new Date(String(r[dateKey] || '')).getTime()
    if (Number.isNaN(t)) continue
    const bucket = buckets.find(b => t >= b.start && t < b.end)
    if (bucket) bucket.value += valueFn(r)
  }
  return buckets.map(({ label, value }) => ({ label, value }))
}

export default async function AdminHomePage() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [membersRes, bizRes, eventsRes, regsRes] = await Promise.all([
    supabaseAdmin.from('members').select('id, created_at, status, invite_token, invite_opened_at, invite_used_at'),
    supabaseAdmin.from('business_submissions').select('id, created_at, status, document_expiry_date, delisted_at, listing_fee_exempt, listing_paid_until, featured, featured_paid_until, website_fail_count'),
    supabaseAdmin.from('events').select('id, created_at, title, event_date, status'),
    supabaseAdmin.from('event_registrations').select('id, event_id, status, quantity, created_at'),
  ])

  const members = (membersRes.data as Row[]) || []
  const businesses = (bizRes.data as Row[]) || []
  const events = (eventsRes.data as Row[]) || []
  const regs = (regsRes.data as Row[]) || []

  const since = (rows: Row[]) => rows.filter(r => String(r.created_at || '') >= weekAgo).length

  const paidMembers = members.filter(m => m.status === 'paid').length
  const pendingBiz = businesses.filter(b => b.status === 'pending').length
  const approvedBiz = businesses.filter(b => b.status === 'approved').length
  const rejectedBiz = businesses.filter(b => b.status === 'rejected').length
  const upcoming = events.filter(e => new Date(String(e.event_date)) >= new Date())

  const documentsExpiringSoon = businesses.filter(b =>
    b.status === 'approved' && !b.delisted_at && b.document_expiry_date &&
    daysUntil(String(b.document_expiry_date)) >= 0 && daysUntil(String(b.document_expiry_date)) <= LICENSE_ALERT_DAYS
  ).length
  const documentsExpired = businesses.filter(b => !!b.delisted_at).length
  const abandonedCheckouts = members.filter(m => m.status === 'pending').length
  // Flags an invite link that was opened (page loaded) but never actually
  // confirmed (button clicked) after a reasonable grace period - the
  // signature of an email security scanner (e.g. Outlook/Hotmail Safe
  // Links) silently burning a single-use invite before the real recipient
  // ever saw the email, rather than the member simply not having clicked yet.
  const tenMinAgo = Date.now() - 10 * 60 * 1000
  const staleInvites = members.filter(m =>
    m.status === 'paid' && m.invite_token && m.invite_opened_at && !m.invite_used_at &&
    new Date(String(m.invite_opened_at)).getTime() < tenMinAgo
  ).length

  // Two consecutive failed weekly checks, so not a blip.
  const brokenWebsites = businesses.filter(b =>
    b.status === 'approved' && !b.delisted_at && Number(b.website_fail_count || 0) >= 2
  ).length

  const listingsAwaitingPayment = businesses.filter(b =>
    b.status === 'approved' && !b.listing_fee_exempt && !b.listing_paid_until
  ).length

  const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const listingsRenewingSoon = businesses.filter(b => {
    if (b.status !== 'approved' || b.listing_fee_exempt || !b.listing_paid_until) return false
    const d = new Date(String(b.listing_paid_until))
    return d >= new Date() && d <= in14
  }).length
  const featuredRenewingSoon = businesses.filter(b => {
    if (b.status !== 'approved' || !b.featured || !b.featured_paid_until) return false
    const d = new Date(String(b.featured_paid_until))
    return d >= new Date() && d <= in14
  }).length

  const perEvent = events
    .map(e => {
      const rows = regs.filter(r => r.event_id === e.id && r.status === 'paid')
      return {
        id: String(e.id),
        title: String(e.title),
        date: String(e.event_date),
        bookings: rows.length,
        tickets: rows.reduce((sum, r) => sum + (Number(r.quantity) || 1), 0),
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const ticketsWeek = regs
    .filter(r => r.status === 'paid' && String(r.created_at || '') >= weekAgo)
    .reduce((s, r) => s + (Number(r.quantity) || 1), 0)

  // Weekly trend series for the charts view.
  const membersWeekly = weeklyBuckets(members, 'created_at', () => 1)
  const businessesWeekly = weeklyBuckets(businesses, 'created_at', () => 1)
  const ticketsWeekly = weeklyBuckets(
    regs.filter(r => r.status === 'paid'),
    'created_at',
    r => Number(r.quantity) || 1
  )

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Dashboard" />
      <DashboardClient
        data={{
          paidMembers,
          totalMembers: members.length,
          approvedBiz,
          pendingBiz,
          rejectedBiz,
          upcomingEvents: upcoming.length,
          licensesExpiringSoon: documentsExpiringSoon,
          licensesExpired: documentsExpired,
          abandonedCheckouts,
          staleInvites,
          listingsAwaitingPayment,
          brokenWebsites,
          listingsRenewingSoon,
          featuredRenewingSoon,
          newMembersWeek: since(members.filter(m => m.status !== 'pending')),
          newBusinessesWeek: since(businesses),
          newEventsWeek: since(events),
          ticketsWeek,
          perEvent,
          membersWeekly,
          businessesWeekly,
          ticketsWeekly,
        }}
      />
    </div>
  )
}
