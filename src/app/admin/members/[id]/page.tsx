import Link from 'next/link'
import { recoveryOf, describeRecovery } from '@/lib/member-recovery'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, Phone, MapPin, CalendarDays, Store, Ticket, ExternalLink } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import AdminNav from '@/components/admin/AdminNav'
import { formatEventDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Human labels for the extra fields kept in the members.details jsonb blob.
const DETAIL_LABELS: Record<string, string> = {
  whatsappNumber: 'WhatsApp number',
  uaeMobile: 'UAE mobile',
  emirate: 'Emirate',
  ukCity: 'UK city',
  indiaCity: 'India city',
  religion: 'Religion',
  referrerName: 'Referred by',
  referrerMobile: 'Referrer mobile',
  howHeard: 'How they heard about BILD',
  industry: 'Industry',
  jobTitle: 'Job title',
  companyName: 'Company',
  businessType: 'Business type',
  yearOfBirth: 'Year of birth',
  maritalStatus: 'Marital status',
  movedDate: 'Moved to UAE',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  promoInterest: 'Interested in promoting',
  sponsorInterest: 'Interested in sponsoring',
}

// The three consent tick-boxes are always "yes" for anyone who completed the
// form, so they add noise rather than information on this screen.
const HIDDEN_DETAIL_KEYS = new Set(['termsConfirm', 'heritageConfirm', 'falseInfoConfirm'])

function shortDate(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-white font-semibold mb-4">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2 justify-between py-2 border-b border-charcoal-700/60 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-200 text-sm text-right break-all">{value ?? '-'}</span>
    </div>
  )
}

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!member) notFound()

  const email = (member.email || '').trim()

  // Everything below is matched on email, which is the only identifier shared
  // across members, event bookings, and directory listings. ilike (no
  // wildcards) makes that match case-insensitive, since people type their
  // address differently on different forms.
  const [{ data: regs }, { data: businesses }] = email
    ? await Promise.all([
        supabaseAdmin
          .from('event_registrations')
          .select('id, event_id, ticket_name, quantity, amount_aed, status, created_at, paid_at, guest_names')
          .ilike('email', email)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('business_submissions')
          .select('id, business_name, category, status, slug, featured, listing_paid_until, featured_paid_until, created_at')
          .ilike('email', email)
          .order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }]

  const registrations = regs || []
  const listings = businesses || []

  // Pull the event titles/dates for whatever bookings exist.
  const eventIds = Array.from(new Set(registrations.map(r => r.event_id).filter(Boolean)))
  const { data: eventRows } = eventIds.length
    ? await supabaseAdmin.from('events').select('id, title, slug, event_date').in('id', eventIds)
    : { data: [] }
  const eventsById = new Map((eventRows || []).map(e => [e.id, e]))

  const paidRegs = registrations.filter(r => r.status === 'paid')
  const totalSpendAed = paidRegs.reduce((sum, r) => sum + (Number(r.amount_aed) || 0), 0)
  // quantity already covers the whole booking (buyer + their guests).
  const totalTickets = paidRegs.reduce((sum, r) => sum + (Number(r.quantity) || 1), 0)

  const details = (member.details as Record<string, string>) || {}
  const detailEntries = Object.entries(details)
    .filter(([k, v]) => !HIDDEN_DETAIL_KEYS.has(k) && v != null && String(v).trim() !== '')
    // Known/labelled fields first, so the useful ones aren't buried.
    .sort((a, b) => Number(!DETAIL_LABELS[a[0]]) - Number(!DETAIL_LABELS[b[0]]))

  const statusColor =
    member.status === 'paid' ? 'bg-green-500/20 text-green-400'
    : member.status === 'imported' ? 'bg-blue-500/20 text-blue-300'
    : 'bg-orange-500/20 text-orange-400'

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Member profile" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/admin/members" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6">
          <ArrowLeft size={16} /> Back to members
        </Link>

        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">{member.full_name || 'Unnamed member'}</h1>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusColor}`}>
            {member.status === 'pending' ? 'abandoned' : member.status}
          </span>
          {recoveryOf(member as { status: string; created_at: string; paid_at?: string | null; abandoned_reminder_sent_at?: string | null }) && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300">recovered</span>
          )}
        </div>
        <p className="text-gray-500 text-sm mb-8">Member since {shortDate(member.created_at)}</p>

        {/* Snapshot stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Events attended</p>
            <p className="text-white text-2xl font-bold">{paidRegs.length}</p>
          </div>
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Tickets bought</p>
            <p className="text-white text-2xl font-bold">{totalTickets}</p>
          </div>
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Event spend</p>
            <p className="text-white text-2xl font-bold">{totalSpendAed} <span className="text-sm font-normal text-gray-500">AED</span></p>
          </div>
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Listings</p>
            <p className="text-white text-2xl font-bold">{listings.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <Card title="Contact & membership" icon={<Mail size={16} className="text-gold-500" />}>
            <Row label="Email" value={member.email || '-'} />
            <Row label="Phone" value={member.phone || details.uaeMobile || '-'} />
            <Row label="Gender" value={member.gender ? <span className="capitalize">{member.gender}</span> : '-'} />
            <Row label="Emirate" value={member.location || '-'} />
            <Row label="Status" value={member.status === 'pending' ? 'abandoned (never paid)' : member.status} />
            <Row label="Started application" value={shortDate(member.created_at)} />
            <Row label="Paid" value={shortDate(member.paid_at)} />
            {(() => {
              const r = recoveryOf(member as { status: string; created_at: string; paid_at?: string | null; abandoned_reminder_sent_at?: string | null })
              return r ? <Row label="Recovered sign-up" value={describeRecovery(r)} /> : null
            })()}
            <Row label="Amount paid" value={member.amount ? `${(Number(member.amount) / 100).toFixed(2)} AED` : '-'} />
            {member.status === 'pending' && (
              <Row label="Reminder sent" value={shortDate(member.abandoned_reminder_sent_at)} />
            )}
          </Card>

          <Card title="Application details" icon={<MapPin size={16} className="text-gold-500" />}>
            {detailEntries.length === 0 ? (
              <p className="text-gray-500 text-sm">No extra details captured (likely an imported member).</p>
            ) : (
              detailEntries.map(([key, value]) => (
                <Row key={key} label={DETAIL_LABELS[key] || key} value={String(value)} />
              ))
            )}
          </Card>
        </div>

        {member.status === 'paid' && (
          <div className="mb-5">
            <Card title="WhatsApp invite" icon={<Phone size={16} className="text-gold-500" />}>
              <Row label="Invite link opened" value={shortDate(member.invite_opened_at)} />
              <Row label="Invite used (joined group)" value={shortDate(member.invite_used_at)} />
              <Row label="Invite expires" value={shortDate(member.invite_expires_at)} />
            </Card>
          </div>
        )}

        <div className="mb-5">
          <Card title={`Event history (${registrations.length})`} icon={<Ticket size={16} className="text-gold-500" />}>
            {registrations.length === 0 ? (
              <p className="text-gray-500 text-sm">
                {email ? 'No event bookings under this email address.' : 'No email on file, so bookings cannot be matched.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-charcoal-700">
                      <th className="py-2 pr-4 font-medium">Event</th>
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Ticket</th>
                      <th className="py-2 pr-4 font-medium">Qty</th>
                      <th className="py-2 pr-4 font-medium">Paid</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map(r => {
                      const ev = eventsById.get(r.event_id)
                      const guests = Array.isArray(r.guest_names) ? r.guest_names.length : 0
                      return (
                        <tr key={r.id} className="border-b border-charcoal-700/60 last:border-0">
                          <td className="py-2 pr-4 text-white">
                            {ev ? (
                              <Link href={`/events/${ev.slug}`} className="hover:text-gold-500 inline-flex items-center gap-1">
                                {ev.title} <ExternalLink size={12} />
                              </Link>
                            ) : 'Event removed'}
                          </td>
                          <td className="py-2 pr-4 text-gray-400">{ev ? formatEventDate(ev.event_date) : '-'}</td>
                          <td className="py-2 pr-4 text-gray-400">{r.ticket_name || '-'}</td>
                          <td className="py-2 pr-4 text-gray-400">
                            {Number(r.quantity) || 1}{guests > 0 ? ` (+${guests} named)` : ''}
                          </td>
                          <td className="py-2 pr-4 text-gray-400">{r.amount_aed ? `${r.amount_aed} AED` : 'Free'}</td>
                          <td className="py-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              r.status === 'paid' ? 'bg-green-500/20 text-green-400'
                              : r.status === 'refunded' ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title={`Business listings (${listings.length})`} icon={<Store size={16} className="text-gold-500" />}>
          {listings.length === 0 ? (
            <p className="text-gray-500 text-sm">
              {email ? 'No directory listings under this email address.' : 'No email on file, so listings cannot be matched.'}
            </p>
          ) : (
            <div className="space-y-3">
              {listings.map(b => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-charcoal-700/40 rounded-xl">
                  <div>
                    <p className="text-white font-medium flex items-center gap-2">
                      {b.slug ? (
                        <Link href={`/directory/${b.slug}`} className="hover:text-gold-500 inline-flex items-center gap-1">
                          {b.business_name} <ExternalLink size={12} />
                        </Link>
                      ) : b.business_name}
                      {b.featured && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400">Featured</span>}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">{b.category} · submitted {shortDate(b.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      b.status === 'approved' ? 'bg-green-500/20 text-green-400'
                      : b.status === 'rejected' ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {b.status}
                    </span>
                    <p className="text-gray-500 text-xs mt-1 flex items-center gap-1 justify-end">
                      <CalendarDays size={11} /> Listing paid until {shortDate(b.listing_paid_until)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
