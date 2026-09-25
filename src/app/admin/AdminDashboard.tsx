'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { BusinessSubmission } from '@/lib/supabase'
import { CheckCircle, XCircle, Clock, ExternalLink, FileText, Star, TrendingUp, Search, X, Pencil, Trash2, ShieldAlert, AlertTriangle, Loader2, Send } from 'lucide-react'
import Link from 'next/link'
import EditBusinessForm from './EditBusinessForm'
import AdminNav from '@/components/admin/AdminNav'
import { MemberContact, isVerifiedMemberContact } from '@/lib/member-match'
import ModalPortal from '@/components/ui/ModalPortal'

// The anon Supabase client used to live here, purely so the licence button
// could sign a document URL in the browser. That is done on the server now, so
// this screen no longer talks to Supabase directly at all.

type Tab = 'pending' | 'approved' | 'approved_unpaid' | 'never_paid' | 'rejected' | 'featured' | 'licenses' | 'billing' | 'links'

const DOCUMENT_LOOKAHEAD_DAYS = 14

const STATUS_TAB_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  approved_unpaid: 'Approved - Awaiting Payment',
  never_paid: 'Applied, never paid',
  featured: 'Featured',
  rejected: 'Rejected',
}

// A business claims BILD membership on submission, but that's just a
// self-reported field - it's never cross-checked against anyone who has
// actually paid. This flags a claim that doesn't match any paid member by
// email or phone, so admins can catch it before approving at the member rate.
function isVerifiedMember(sub: BusinessSubmission, members: MemberContact[]): boolean {
  return !!sub.membership_manually_verified || isVerifiedMemberContact({ email: sub.email, phone: sub.phone }, members)
}

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

// Billing status for the annual listing fee, independent of admin
// approval status - shown alongside it so it's clear at a glance who's
// actually live vs. still owing payment.
function listingBillingStatus(s: BusinessSubmission): { label: string; className: string } | null {
  if (s.status !== 'approved') return null
  if (s.listing_fee_exempt) return { label: 'Comped', className: 'bg-blue-500/20 text-blue-300' }
  if (s.listing_paid_until && new Date(s.listing_paid_until) >= new Date()) return { label: 'Active', className: 'bg-green-500/20 text-green-400' }
  return { label: 'Awaiting payment', className: 'bg-orange-500/20 text-orange-400' }
}

function featuredBillingStatus(s: BusinessSubmission): { label: string; className: string } | null {
  if (!s.featured) return null
  if (s.featured_paid_until) return { label: 'Featured - Paid', className: 'bg-gold-500/20 text-gold-300' }
  return { label: 'Featured - Comped', className: 'bg-blue-500/20 text-blue-300' }
}

const VALID_TABS: Tab[] = ['pending', 'approved', 'approved_unpaid', 'never_paid', 'rejected', 'featured', 'licenses', 'billing', 'links']

export default function AdminDashboard({ submissions, members }: { submissions: BusinessSubmission[]; members: MemberContact[] }) {
  const searchParams = useSearchParams()
  const initialTab = VALID_TABS.includes(searchParams.get('tab') as Tab) ? (searchParams.get('tab') as Tab) : 'pending'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)
  const [sendingLinkId, setSendingLinkId] = useState<string | null>(null)
  const [sendingPayId, setSendingPayId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'cards' | 'list' | 'table'>('cards')
  // Local optimistic featured state so tick boxes respond instantly
  const [featuredMap, setFeaturedMap] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Deleting a business is permanent, so it goes through a dialog that
  // states what is lost and asks for the admin password again, rather than
  // a browser confirm() that is one stray click away from destroying a
  // listing. The password is also re-checked server-side.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    const init: Record<string, boolean> = {}
    submissions.forEach(s => { init[s.id] = !!s.featured })
    setFeaturedMap(init)
  }, [submissions])

  async function toggleFeatured(id: string) {
    const next = !featuredMap[id]
    setFeaturedMap(prev => ({ ...prev, [id]: next }))
    setSaving(id)
    const res = await fetch('/api/admin/feature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, featured: next }),
    })
    if (!res.ok) {
      // revert on failure
      setFeaturedMap(prev => ({ ...prev, [id]: !next }))
      alert('Could not update. Please try again.')
    }
    setSaving(null)
  }

  const pending = submissions.filter(s => s.status === 'pending')
  const approved = submissions.filter(s => s.status === 'approved')
  const rejected = submissions.filter(s => s.status === 'rejected')
  const featured = approved.filter(s => s.featured)

  const expiringSoon = submissions.filter(s =>
    s.status === 'approved' && !s.delisted_at && s.document_expiry_date &&
    daysUntil(s.document_expiry_date) >= 0 && daysUntil(s.document_expiry_date) <= DOCUMENT_LOOKAHEAD_DAYS
  )
  const expiredDelisted = submissions.filter(s => !!s.delisted_at)
  const pendingRenewal = submissions.filter(s => !!s.pending_renewal_submitted_at)

  const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  // Approved but never paid the initial listing fee at all (distinct from
  // listingExpired, which requires a past listing_paid_until - i.e. they
  // paid once before). listing_payment_token_expires_at tells us when their
  // one-time pay link goes stale, separate from reviewed_at (when the
  // activation email asking them to pay was actually sent).
  // Flagged only after two consecutive failed weekly checks, so a single bad
  // week (a host restarting, a slow response) never reaches this list.
  const brokenLinks = submissions.filter(s =>
    s.status === 'approved' && !s.delisted_at && Number(s.website_fail_count || 0) >= 2
  )
  const withWebsites = submissions.filter(s =>
    s.status === 'approved' && !s.delisted_at && !!s.website
  )

  // Approved, never paid, and no longer being chased: two payment links came
  // and went. Kept out of the working lists so those only show live business,
  // but kept in the data so the drop-off is countable.
  const listingNeverPaid = submissions.filter(s =>
    s.status === 'approved' && !!s.listing_abandoned_at
  )
  const listingAwaitingPayment = submissions.filter(s =>
    s.status === 'approved' && !s.listing_fee_exempt && !s.listing_paid_until && !s.listing_abandoned_at
  )
  const listingRenewingSoon = submissions.filter(s =>
    s.status === 'approved' && !s.listing_fee_exempt && s.listing_paid_until &&
    new Date(s.listing_paid_until) >= new Date() && new Date(s.listing_paid_until) <= in14
  )
  const listingExpired = submissions.filter(s =>
    s.status === 'approved' && !s.listing_fee_exempt && s.listing_paid_until && new Date(s.listing_paid_until) < new Date()
  )
  const featuredRenewingSoon = submissions.filter(s =>
    s.status === 'approved' && s.featured && s.featured_paid_until &&
    new Date(s.featured_paid_until) >= new Date() && new Date(s.featured_paid_until) <= in14
  )
  const featuredExpired = submissions.filter(s =>
    s.status === 'approved' && !s.featured && s.featured_paid_until && new Date(s.featured_paid_until) < new Date()
  )

  // "Approved" excludes awaiting-payment businesses now that they have
  // their own dedicated tab, so nothing shows up in both at once.
  const approvedPaid = approved.filter(s => !listingAwaitingPayment.includes(s) && !s.listing_abandoned_at)

  const byTab =
    tab === 'pending' ? pending :
    tab === 'approved' ? approvedPaid :
    tab === 'approved_unpaid' ? listingAwaitingPayment :
    tab === 'never_paid' ? listingNeverPaid :
    tab === 'featured' ? featured :
    rejected

  const q = search.trim().toLowerCase()
  const matchesQ = (s: BusinessSubmission) =>
    s.business_name.toLowerCase().includes(q) ||
    s.owner_name.toLowerCase().includes(q) ||
    s.category.toLowerCase().includes(q) ||
    s.location.toLowerCase().includes(q) ||
    s.email.toLowerCase().includes(q)

  const filtered = q ? byTab.filter(matchesQ) : byTab
  // Approved businesses for the Table (featured management) view
  const approvedForTable = q ? approved.filter(matchesQ) : approved

  async function handleReview(id: string, action: 'approved' | 'rejected') {
    const reason = notes[id] || ''
    if (action === 'rejected' && !reason.trim()) {
      alert('Please enter a reason for rejection first - this is emailed to the business.')
      return
    }
    setProcessing(id)
    const res = await fetch('/api/admin/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, admin_notes: reason }),
    })
    if (res.ok) {
      // Full reload guarantees fresh server data
      window.location.reload()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Something went wrong. Please try again.')
      setProcessing(null)
    }
  }

  async function handleFeature(id: string, featured: boolean) {
    setProcessing(id)
    const res = await fetch('/api/admin/feature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, featured }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      alert('Something went wrong. Please try again.')
      setProcessing(null)
    }
  }

  // Emails a Featured business its link to manage its Featured content. Needed
  // for businesses featured with the admin switch, which never pay and so
  // never receive the link automatically. The link is shown to the admin too,
  // so it can be passed on if the email does not arrive.
  async function handleSendManageLink(id: string, businessName: string) {
    if (!confirm(`Email ${businessName} their link to manage their Featured content?`)) return
    setSendingLinkId(id)
    const res = await fetch('/api/admin/feature/manage-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const d = await res.json().catch(() => ({}))
    setSendingLinkId(null)
    if (res.ok) {
      window.prompt(`Sent to ${d.sentTo}. Their link is below if you need to pass it on yourself:`, d.manageUrl)
    } else if (d.manageUrl) {
      window.prompt(`The email could not be sent (${d.emailError || 'unknown error'}). Copy the link below and send it to them yourself:`, d.manageUrl)
    } else {
      alert(d.error || 'Could not send the link. Please try again.')
    }
  }

  // Emails an approved business a fresh link to pay its listing fee.
  //
  // The link created at approval lasts seven days. After that the business
  // cannot pay at all: the payment page tells them to ask BILD for a new one,
  // and until this button there was no way to give them one, so an unpaid
  // listing stayed invisible in the directory indefinitely.
  async function handleSendPaymentLink(id: string, businessName: string) {
    if (!confirm(`Email ${businessName} a new link to pay for their listing?\n\nThis replaces any previous link, which stops working.`)) return
    setSendingPayId(id)
    const res = await fetch('/api/admin/business/listing-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const d = await res.json().catch(() => ({}))
    setSendingPayId(null)
    if (res.ok) {
      window.prompt(
        `Sent to ${d.sentTo} (${d.feeAed} AED). The link works for 7 days. Copy it below if you want to send it yourself as well:`,
        d.payUrl,
      )
    } else {
      alert(d.error || 'Could not send the payment link. Please try again.')
    }
  }

  async function handleVerifyMembership(id: string, verified: boolean) {
    setProcessing(id)
    const res = await fetch('/api/admin/business/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, membership_manually_verified: verified }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      alert('Something went wrong. Please try again.')
      setProcessing(null)
    }
  }

  function handleDelete(id: string, name: string) {
    setDeletePassword('')
    setDeleteError('')
    setDeleteTarget({ id, name })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (!deletePassword) {
      setDeleteError('Please enter the admin password.')
      return
    }
    setDeleteError('')
    setDeleteBusy(true)
    const res = await fetch('/api/admin/business/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteTarget.id, password: deletePassword }),
    })
    if (res.ok) {
      window.location.reload()
      return
    }
    const d = await res.json().catch(() => ({}))
    setDeleteError(d.error === 'Incorrect password.' ? 'Incorrect password.' : 'Could not delete. Please try again.')
    setDeleteBusy(false)
  }

  async function handleRenewal(id: string, action: 'approve' | 'decline') {
    const reason = notes[id] || ''
    if (action === 'decline' && !reason.trim()) {
      alert('Please enter a reason for declining first - this is emailed to the business.')
      return
    }
    setProcessing(id)
    const res = await fetch('/api/admin/business/renewal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, admin_notes: reason }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Something went wrong. Please try again.')
      setProcessing(null)
    }
  }

  async function handleRelist(id: string, name: string) {
    if (!confirm(`Re-list "${name}"? Make sure you've already set their new document expiry date via Edit.`)) return
    setProcessing(id)
    const res = await fetch('/api/admin/business/relist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      alert('Could not re-list. Please try again.')
      setProcessing(null)
    }
  }

  return (
    <div className="min-h-screen bg-charcoal-900">
      <AdminNav subtitle="Business Directory" />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-end gap-2 mb-4">
          <Link
            href="/admin/directory/stats"
            className="inline-flex items-center gap-2 bg-charcoal-800 border border-charcoal-700 hover:border-gold-500 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            title="Views and enquiries per listing, and who is worth approaching about Featured"
          >
            <TrendingUp size={15} className="text-gold-400" /> Performance
          </Link>
          <Link
            href="/admin/directory/google-reviews"
            className="inline-flex items-center gap-2 bg-charcoal-800 border border-charcoal-700 hover:border-gold-500 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            title="Email businesses a personal link to add their own Google reviews"
          >
            <Star size={15} className="text-gold-400" /> Google reviews invitation
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          {[
            { label: 'Pending Review', count: pending.length, colour: 'text-yellow-400', tab: 'pending' as Tab },
            { label: 'Approved', count: approvedPaid.length, colour: 'text-green-400', tab: 'approved' as Tab },
            { label: 'Featured', count: featured.length, colour: 'text-gold-400', tab: 'featured' as Tab },
            { label: 'Rejected', count: rejected.length, colour: 'text-red-400', tab: 'rejected' as Tab },
            { label: 'Documents', count: expiringSoon.length + expiredDelisted.length + pendingRenewal.length, colour: 'text-orange-400', tab: 'licenses' as Tab },
            { label: 'Business awaiting payment', count: listingAwaitingPayment.length + listingRenewingSoon.length + listingExpired.length + featuredRenewingSoon.length + featuredExpired.length, colour: 'text-blue-400', tab: 'billing' as Tab },
            { label: 'Websites not working', count: brokenLinks.length, colour: 'text-red-400', tab: 'links' as Tab },
          ].map(s => (
            <button
              key={s.tab}
              onClick={() => setTab(s.tab)}
              className={`bg-charcoal-800 rounded-xl p-5 text-left border transition-colors ${tab === s.tab ? 'border-gold-500' : 'border-charcoal-700 hover:border-charcoal-600'}`}
            >
              <p className={`text-3xl font-display font-bold ${s.colour}`}>{s.count}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Search + view toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by business, owner, category, location, email..."
              className="w-full pl-11 pr-4 py-2.5 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="inline-flex rounded-xl bg-charcoal-800 border border-charcoal-700 p-1 self-start">
            <button
              onClick={() => setView('cards')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'cards' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Review cards
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'list' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              List view
            </button>
            <button
              onClick={() => setView('table')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'table' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Feature list
            </button>
          </div>
        </div>

        {/* LINKS TAB: listings whose website has failed the weekly check twice */}
        {tab === 'links' ? (
          <BrokenLinksSection businesses={brokenLinks} allWithWebsites={withWebsites} onEdit={setEditingId} />
        ) : tab === 'licenses' ? (
          <LicensesSection
            expiringSoon={expiringSoon}
            expiredDelisted={expiredDelisted}
            pendingRenewal={pendingRenewal}
            notes={notes}
            setNotes={setNotes}
            processing={processing}
            onApprove={id => handleRenewal(id, 'approve')}
            onDecline={id => handleRenewal(id, 'decline')}
            onRelist={handleRelist}
          />
        ) : tab === 'billing' ? (
          <BillingSection
            listingAwaitingPayment={listingAwaitingPayment}
            listingRenewingSoon={listingRenewingSoon}
            listingExpired={listingExpired}
            featuredRenewingSoon={featuredRenewingSoon}
            featuredExpired={featuredExpired}
          />
        ) :
        /* LIST VIEW: all businesses in one line each, with edit + delete */
        view === 'list' ? (
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-charcoal-700">
              <h2 className="font-display font-bold text-white">All businesses</h2>
              <p className="text-gray-400 text-sm mt-0.5">{filtered.length} in {tab}. Use the tabs below to switch status.</p>
            </div>
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-sm px-5 py-10 text-center">No {tab} businesses{search ? ' match your search' : ''}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-charcoal-700">
                      <th className="px-5 py-3 font-medium">Business</th>
                      <th className="px-5 py-3 font-medium">Owner</th>
                      <th className="px-5 py-3 font-medium">Category</th>
                      <th className="px-5 py-3 font-medium">Location</th>
                      <th className="px-5 py-3 font-medium">Phone</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(s => (
                      <tr key={s.id} className="border-b border-charcoal-700/60 hover:bg-charcoal-700/40">
                        <td className="px-5 py-3 text-white font-medium">
                          <span className="inline-flex items-center gap-2">
                            {s.business_name}
                            {s.featured && <Star size={12} className="text-gold-400 fill-gold-400" />}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400">{s.owner_name}</td>
                        <td className="px-5 py-3 text-gray-400">{s.category}</td>
                        <td className="px-5 py-3 text-gray-400">{s.location}</td>
                        <td className="px-5 py-3 text-gray-400">{s.phone || '-'}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              s.status === 'approved' ? 'bg-green-500/20 text-green-400'
                              : s.status === 'rejected' ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'}`}>{s.status}</span>
                            {listingBillingStatus(s) && (
                              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${listingBillingStatus(s)!.className}`}>
                                {listingBillingStatus(s)!.label}
                              </span>
                            )}
                            {featuredBillingStatus(s) && (
                              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${featuredBillingStatus(s)!.className}`}>
                                {featuredBillingStatus(s)!.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setView('cards'); setTab(s.status as Tab); setEditingId(s.id) }}
                              className="p-2 text-gray-400 hover:text-white"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id, s.business_name)}
                              disabled={processing === s.id}
                              className="p-2 text-gray-400 hover:text-red-400 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Status tabs for the list view */}
            <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-charcoal-700">
              {(['pending', 'approved', 'approved_unpaid', 'never_paid', 'featured', 'rejected'] as Tab[]).map(t => {
                const count = t === 'pending' ? pending.length : t === 'approved' ? approvedPaid.length : t === 'approved_unpaid' ? listingAwaitingPayment.length : t === 'never_paid' ? listingNeverPaid.length : t === 'featured' ? featured.length : rejected.length
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-gold-500 text-white' : 'bg-charcoal-700 text-gray-400 hover:text-white'}`}
                  >
                    {STATUS_TAB_LABELS[t]} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        ) : view === 'table' ? (
          <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-charcoal-700">
              <h2 className="font-display font-bold text-white">Feature businesses</h2>
              <p className="text-gray-400 text-sm mt-0.5">Tick a business to feature it on the directory. Changes save instantly.</p>
            </div>
            {approvedForTable.length === 0 ? (
              <p className="text-gray-500 text-sm px-5 py-10 text-center">No approved businesses{search ? ' match your search' : ' yet'}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-charcoal-700">
                      <th className="px-5 py-3 font-medium">Business name</th>
                      <th className="px-5 py-3 font-medium">Owner</th>
                      <th className="px-5 py-3 font-medium text-center w-28">Featured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedForTable.map(s => (
                      <tr key={s.id} className="border-b border-charcoal-700/60 hover:bg-charcoal-700/40">
                        <td className="px-5 py-3 text-white font-medium">{s.business_name}</td>
                        <td className="px-5 py-3 text-gray-400">{s.owner_name}</td>
                        <td className="px-5 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!featuredMap[s.id]}
                            disabled={saving === s.id}
                            onChange={() => toggleFeatured(s.id)}
                            className="h-5 w-5 accent-gold-500 cursor-pointer disabled:opacity-50"
                            aria-label={`Feature ${s.business_name}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
        <>
        {/* CARDS VIEW below */}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['pending', 'approved', 'approved_unpaid', 'never_paid', 'featured', 'rejected'] as Tab[]).map(t => {
            const count = t === 'pending' ? pending.length : t === 'approved' ? approvedPaid.length : t === 'approved_unpaid' ? listingAwaitingPayment.length : t === 'never_paid' ? listingNeverPaid.length : t === 'featured' ? featured.length : rejected.length
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-gold-500 text-white' : 'bg-charcoal-800 text-gray-400 hover:text-white'}`}
              >
                {STATUS_TAB_LABELS[t]} ({count})
              </button>
            )
          })}
        </div>

        {search && (
          <p className="text-gray-500 text-sm mb-4">
            {filtered.length} result{filtered.length === 1 ? '' : 's'} for &ldquo;{search}&rdquo; in {tab}
          </p>
        )}

        {/* Submissions */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Clock size={40} className="mx-auto mb-4 opacity-40" />
            <p>No {tab} submissions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(sub => (
              <div key={sub.id} className="bg-charcoal-800 rounded-2xl border border-charcoal-700 overflow-hidden">
                {/* Card header */}
                <div className="flex items-start justify-between p-6 border-b border-charcoal-700">
                  <div className="flex items-start gap-4">
                    {sub.logo_url && sub.logo_url.startsWith('http') && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sub.logo_url} alt={`${sub.business_name} logo`}
                        className="w-14 h-14 rounded-xl object-cover border border-charcoal-600 bg-white shrink-0" />
                    )}
                    <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h2 className="font-display text-xl font-bold text-white">{sub.business_name}</h2>
                      <span className="bg-gold-500/20 text-gold-400 text-xs font-medium px-2.5 py-0.5 rounded-full">{sub.category}</span>
                      {sub.featured && (
                        <span className="inline-flex items-center gap-1 bg-gold-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                          <Star size={11} className="fill-white" /> Featured
                        </span>
                      )}
                      {sub.is_bild_member === false && (
                        <span className="text-xs bg-charcoal-700 text-gray-300 px-2 py-0.5 rounded-full">Non-BILD</span>
                      )}
                      {sub.is_bild_member !== false && sub.membership_manually_verified && (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full" title="Manually verified by an admin (overrides the automatic email/phone match)">
                          <CheckCircle size={11} /> Membership verified (manual)
                          <button
                            onClick={() => handleVerifyMembership(sub.id, false)}
                            disabled={processing === sub.id}
                            className="ml-1 text-green-400 hover:text-white underline disabled:opacity-50"
                          >
                            Undo
                          </button>
                        </span>
                      )}
                      {sub.is_bild_member !== false && !isVerifiedMember(sub, members) && (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full" title="No paid member matches this business's email or phone">
                          <ShieldAlert size={11} /> Membership unverified
                          <button
                            onClick={() => handleVerifyMembership(sub.id, true)}
                            disabled={processing === sub.id}
                            className="ml-1 text-red-300 hover:text-white underline disabled:opacity-50"
                            title="I've manually confirmed this business is a BILD member (e.g. from a spreadsheet not yet imported)"
                          >
                            Verify manually
                          </button>
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">{sub.owner_name} · {sub.location}</p>
                    <p className="text-gray-500 text-xs mt-1">Submitted {new Date(sub.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => setEditingId(editingId === sub.id ? null : sub.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        editingId === sub.id
                          ? 'bg-gold-500 text-white hover:bg-gold-600'
                          : 'bg-charcoal-700 text-gray-300 hover:bg-charcoal-600'
                      }`}
                      title="Edit business details"
                    >
                      <Pencil size={13} /> {editingId === sub.id ? 'Editing' : 'Edit'}
                    </button>
                    {/* Feature toggle - only for approved businesses */}
                    {sub.status === 'approved' && (
                      <button
                        onClick={() => handleFeature(sub.id, !sub.featured)}
                        disabled={processing === sub.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                          sub.featured
                            ? 'bg-gold-500 text-white hover:bg-gold-600'
                            : 'bg-charcoal-700 text-gray-300 hover:bg-charcoal-600'
                        }`}
                        title={sub.featured ? 'Remove from featured' : 'Add to featured'}
                      >
                        <Star size={13} className={sub.featured ? 'fill-white' : ''} />
                        {sub.featured ? 'Featured' : 'Feature'}
                      </button>
                    )}
                    {sub.status === 'approved' && (
                      <button
                        onClick={() => handleSendManageLink(sub.id, sub.business_name)}
                        disabled={sendingLinkId === sub.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 bg-charcoal-700 text-gray-300 hover:bg-charcoal-600"
                        title="Email this business its manage link: customer testimonials for everyone, plus bio, photos, video, offers and brochure for Featured listings"
                      >
                        {sendingLinkId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        Send manage link
                      </button>
                    )}
                    {sub.status === 'approved' && !sub.listing_fee_exempt &&
                      (!sub.listing_paid_until || new Date(sub.listing_paid_until) < new Date()) && (
                      <button
                        onClick={() => handleSendPaymentLink(sub.id, sub.business_name)}
                        disabled={sendingPayId === sub.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 bg-blue-900/60 text-blue-200 hover:bg-blue-900"
                        title="Email this business a fresh link to pay their listing fee. Their listing is not live until they pay."
                      >
                        {sendingPayId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        Send payment link
                      </button>
                    )}
                    {sub.status === 'approved' && <CheckCircle className="text-green-400" size={24} />}
                    {sub.status === 'rejected' && <XCircle className="text-red-400" size={24} />}
                    {sub.status === 'pending' && <Clock className="text-yellow-400" size={24} />}
                    <button
                      onClick={() => handleDelete(sub.id, sub.business_name)}
                      disabled={processing === sub.id}
                      className="p-2 text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                      title="Delete business"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Edit form replaces the details grid when editing */}
                {editingId === sub.id ? (
                  <EditBusinessForm sub={sub} onCancel={() => setEditingId(null)} />
                ) : (
                <>
                {/* Details grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Detail label="Description" value={sub.description} />
                    <Detail label="Email" value={sub.email} />
                    <Detail label="Phone" value={sub.phone} />
                    {sub.website && <Detail label="Website" value={sub.website} link />}
                    {sub.instagram && <Detail label="Instagram" value={`@${sub.instagram}`} />}
                    {sub.tagline && <Detail label="Tagline" value={sub.tagline} />}
                  </div>
                  <div className="space-y-3">
                    <Detail label="BILD Member" value={sub.is_bild_member === false ? 'No' : isVerifiedMember(sub, members) ? 'Yes (verified)' : 'Yes (unverified - no match in paid members)'} highlight={sub.is_bild_member !== false && !isVerifiedMember(sub, members)} />
                    <Detail label="Registered in" value={sub.business_country === 'UK' ? '🇬🇧 UK' : '🇦🇪 UAE'} />
                    {sub.established_year && <Detail label="Established" value={sub.established_year} />}
                    {sub.years_in_business && <Detail label="Years in Business" value={sub.years_in_business} />}
                    {sub.bild_offer && <Detail label="BILD Member Offer" value={sub.bild_offer} highlight />}
                    {sub.extra_info && <Detail label="Extra Info" value={sub.extra_info} />}
                    {sub.logo_url && <Detail label="Logo URL" value={sub.logo_url} link />}
                    {sub.admin_notes && <Detail label="Admin Notes" value={sub.admin_notes} />}
                    {sub.document_url && <LicenseButton path={sub.document_url} />}
                  </div>
                </div>

                {/* Actions only show for pending */}
                {sub.status === 'pending' && (
                  <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
                    <textarea
                      placeholder="Notes - required if rejecting: this becomes the reason emailed to the business"
                      value={notes[sub.id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [sub.id]: e.target.value }))}
                      rows={2}
                      className="flex-1 px-4 py-2.5 bg-charcoal-700 border border-charcoal-600 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
                    />
                    <div className="flex gap-2 sm:flex-col">
                      <button
                        onClick={() => handleReview(sub.id, 'approved')}
                        disabled={processing === sub.id}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={16} /> Approve
                      </button>
                      <button
                        onClick={() => handleReview(sub.id, 'rejected')}
                        disabled={processing === sub.id}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {deleteTarget && (
        <DeleteBusinessDialog
          name={deleteTarget.name}
          password={deletePassword}
          onPasswordChange={setDeletePassword}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}

function DeleteBusinessDialog({
  name, password, onPasswordChange, error, busy, onCancel, onConfirm,
}: {
  name: string
  password: string
  onPasswordChange: (v: string) => void
  error: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <ModalPortal onClose={onCancel}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-charcoal-800 border border-red-500/40 rounded-2xl w-full max-w-md p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </span>
            <div>
              <h3 className="text-white font-semibold text-lg leading-tight">Delete this business?</h3>
              <p className="text-gray-400 text-sm mt-1">
                You are about to permanently delete <strong className="text-white">{name}</strong>.
              </p>
            </div>
          </div>

          <div className="bg-charcoal-900 border border-charcoal-600 rounded-xl p-4 mb-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-medium mb-2">This cannot be undone</p>
            <ul className="text-sm text-gray-300 space-y-1.5">
              <li className="flex gap-2"><span className="text-red-400">&bull;</span> Their public directory page stops working immediately</li>
              <li className="flex gap-2"><span className="text-red-400">&bull;</span> Their logo, banner, photos and licence document are unlinked</li>
              <li className="flex gap-2"><span className="text-red-400">&bull;</span> Listing and Featured payment history is detached from them</li>
              <li className="flex gap-2"><span className="text-red-400">&bull;</span> Their manage and renewal links stop working</li>
            </ul>
            <p className="text-gray-500 text-xs mt-3 leading-relaxed">
              If the business has simply lapsed or asked to pause, edit the listing instead. Deleting is only for a
              duplicate or a submission that should never have existed.
            </p>
          </div>

          <label className="block mb-4">
            <span className="text-gray-400 text-xs block mb-1.5">Enter the admin password to confirm</span>
            <input
              type="password"
              value={password}
              autoFocus
              onChange={e => onPasswordChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !busy) onConfirm() }}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </label>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-charcoal-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Delete permanently
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

function BrokenLinksSection({ businesses, allWithWebsites, onEdit }: {
  businesses: BusinessSubmission[]
  allWithWebsites: BusinessSubmission[]
  onEdit: (id: string) => void
}) {
  const lastChecked = allWithWebsites
    .map(b => b.website_checked_at)
    .filter(Boolean)
    .sort()
    .pop()

  return (
    <div className="space-y-4">
      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-5">
        <h3 className="text-white font-semibold">Website health</h3>
        <p className="text-gray-400 text-sm mt-1 leading-relaxed">
          Every approved listing with a website is checked once a week. A listing appears here only after failing
          twice in a row, so a single slow week never raises a false alarm. Nothing is ever unpublished
          automatically.
        </p>
        <p className="text-gray-500 text-xs mt-3">
          {allWithWebsites.length} listing{allWithWebsites.length === 1 ? '' : 's'} with a website ·{' '}
          {lastChecked
            ? `last checked ${new Date(lastChecked).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : 'not checked yet, the first run is on Monday'}
        </p>
      </div>

      {businesses.length === 0 ? (
        <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl p-8 text-center">
          <p className="text-green-400 font-semibold">Every listed website is working</p>
          <p className="text-gray-500 text-sm mt-1">Nothing to do here.</p>
        </div>
      ) : (
        businesses.map(b => (
          <div key={b.id} className="bg-charcoal-800 border border-red-500/40 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-white font-semibold">{b.business_name}</h3>
                <a
                  href={b.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold-400 hover:underline text-sm inline-flex items-center gap-1 mt-0.5"
                >
                  {b.website} <ExternalLink size={12} />
                </a>
                <p className="text-red-400 text-sm mt-1.5">
                  {b.website_error || 'Not working'}
                  {b.website_fail_count ? ` · failed ${b.website_fail_count} checks in a row` : ''}
                </p>
                {b.email && (
                  <p className="text-gray-500 text-xs mt-2">
                    Owner: {b.owner_name || 'unknown'} ·{' '}
                    <a href={`mailto:${b.email}`} className="text-gold-400 hover:underline">{b.email}</a>
                    {b.phone ? ` · ${b.phone}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`mailto:${b.email}?subject=${encodeURIComponent('Your BILD directory listing: website not loading')}&body=${encodeURIComponent(
                    `Hi ${b.owner_name?.split(' ')[0] || 'there'},\n\nWe run a weekly check on the websites linked from the BILD Business Directory, and ${b.website} has not been loading for us.\n\nCould you let us know the correct address, or tell us once it is back up? In the meantime your listing is still live, we have just flagged the link.\n\nThanks,\nBILD\nconnect@bild.ae`
                  )}`}
                  className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Email the owner
                </a>
                <button
                  onClick={() => onEdit(b.id)}
                  className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  <Pencil size={14} /> Edit listing
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function LicensesSection({
  expiringSoon,
  expiredDelisted,
  pendingRenewal,
  notes,
  setNotes,
  processing,
  onApprove,
  onDecline,
  onRelist,
}: {
  expiringSoon: BusinessSubmission[]
  expiredDelisted: BusinessSubmission[]
  pendingRenewal: BusinessSubmission[]
  notes: Record<string, string>
  setNotes: (fn: (prev: Record<string, string>) => Record<string, string>) => void
  processing: string | null
  onApprove: (id: string) => void
  onDecline: (id: string) => void
  onRelist: (id: string, name: string) => void
}) {
  return (
    <div className="space-y-8">
      {/* Expiring soon */}
      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal-700">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <ShieldAlert size={16} className="text-yellow-400" /> Expiring soon
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Documents expiring within {DOCUMENT_LOOKAHEAD_DAYS} days.</p>
        </div>
        {expiringSoon.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-8 text-center">No documents expiring soon.</p>
        ) : (
          <div className="divide-y divide-charcoal-700/60">
            {expiringSoon.map(s => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium">{s.business_country === 'UK' ? '🇬🇧' : '🇦🇪'} {s.business_name}</p>
                  <p className="text-gray-400 text-sm">
                    Expires {s.document_expiry_date} ({daysUntil(s.document_expiry_date!)} day{daysUntil(s.document_expiry_date!) === 1 ? '' : 's'})
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${s.document_reminder_sent_at ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {s.document_reminder_sent_at ? 'Reminder sent' : 'Reminder pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expired & delisted */}
      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal-700">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <XCircle size={16} className="text-red-400" /> Expired &amp; delisted
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Removed from the public directory after their document expired.</p>
        </div>
        {expiredDelisted.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-8 text-center">No delisted businesses.</p>
        ) : (
          <div className="divide-y divide-charcoal-700/60">
            {expiredDelisted.map(s => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium">{s.business_country === 'UK' ? '🇬🇧' : '🇦🇪'} {s.business_name}</p>
                  <p className="text-gray-400 text-sm">
                    Document expired {s.document_expiry_date} · delisted {s.delisted_at ? new Date(s.delisted_at).toLocaleDateString('en-GB') : ''}
                  </p>
                </div>
                <button
                  onClick={() => onRelist(s.id, s.business_name)}
                  disabled={processing === s.id}
                  className="shrink-0 inline-flex items-center gap-1.5 bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Re-list
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending renewal approval */}
      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal-700">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <Clock size={16} className="text-gold-400" /> Pending renewal approval
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Businesses that have uploaded a renewed document.</p>
        </div>
        {pendingRenewal.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-8 text-center">No renewals awaiting review.</p>
        ) : (
          <div className="divide-y divide-charcoal-700/60">
            {pendingRenewal.map(s => (
              <div key={s.id} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-white font-medium">{s.business_country === 'UK' ? '🇬🇧' : '🇦🇪'} {s.business_name}</p>
                    <p className="text-gray-400 text-sm">New expiry date: {s.pending_document_expiry_date}</p>
                  </div>
                  {s.pending_document_url && <LicenseButton path={s.pending_document_url} />}
                </div>
                <textarea
                  placeholder="Notes - required if declining: this becomes the reason emailed to the business"
                  value={notes[s.id] || ''}
                  onChange={e => setNotes(prev => ({ ...prev, [s.id]: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-charcoal-700 border border-charcoal-600 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onApprove(s.id)}
                    disabled={processing === s.id}
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button
                    onClick={() => onDecline(s.id)}
                    disabled={processing === s.id}
                    className="flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <XCircle size={16} /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BillingRow({ s, dateLabel, dateValue, badge }: { s: BusinessSubmission; dateLabel: string; dateValue: string; badge: { label: string; className: string } }) {
  return (
    <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <p className="text-white font-medium">{s.business_country === 'UK' ? '🇬🇧' : '🇦🇪'} {s.business_name}</p>
        {s.is_bild_member === false && <span className="text-xs bg-charcoal-700 text-gray-300 px-2 py-0.5 rounded-full">Non-BILD</span>}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-gray-400 text-sm">{dateLabel} {dateValue}</span>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${badge.className}`}>{badge.label}</span>
      </div>
    </div>
  )
}

function BillingSection({
  listingAwaitingPayment, listingRenewingSoon, listingExpired, featuredRenewingSoon, featuredExpired,
}: {
  listingAwaitingPayment: BusinessSubmission[]
  listingRenewingSoon: BusinessSubmission[]
  listingExpired: BusinessSubmission[]
  featuredRenewingSoon: BusinessSubmission[]
  featuredExpired: BusinessSubmission[]
}) {
  return (
    <div className="space-y-8">
      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal-700">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <ShieldAlert size={16} className="text-orange-400" /> Approved, awaiting payment
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Approved but never paid the initial listing fee. Email date/time shown is when the activation email was sent.</p>
        </div>
        {listingAwaitingPayment.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-8 text-center">No approved businesses awaiting their first payment.</p>
        ) : (
          <div className="divide-y divide-charcoal-700/60">
            {listingAwaitingPayment.map(s => (
              <BillingRow
                key={s.id}
                s={s}
                dateLabel="Email sent"
                dateValue={s.reviewed_at ? new Date(s.reviewed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                badge={{ label: 'Awaiting payment', className: 'bg-orange-500/20 text-orange-400' }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal-700">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <ShieldAlert size={16} className="text-yellow-400" /> Listings renewing soon
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Annual listing fee due within 14 days.</p>
        </div>
        {listingRenewingSoon.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-8 text-center">No listings renewing soon.</p>
        ) : (
          <div className="divide-y divide-charcoal-700/60">
            {listingRenewingSoon.map(s => (
              <BillingRow key={s.id} s={s} dateLabel="Renews" dateValue={new Date(s.listing_paid_until!).toLocaleDateString('en-GB')} badge={{ label: 'Reminded', className: 'bg-yellow-500/20 text-yellow-400' }} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal-700">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <XCircle size={16} className="text-red-400" /> Listings expired
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Hidden from the public directory until renewed.</p>
        </div>
        {listingExpired.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-8 text-center">No expired listings.</p>
        ) : (
          <div className="divide-y divide-charcoal-700/60">
            {listingExpired.map(s => (
              <BillingRow key={s.id} s={s} dateLabel="Expired" dateValue={new Date(s.listing_paid_until!).toLocaleDateString('en-GB')} badge={{ label: 'Hidden', className: 'bg-red-500/20 text-red-400' }} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal-700">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <Star size={16} className="text-gold-400" /> Featured renewing soon
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Quarterly Featured fee due within 14 days.</p>
        </div>
        {featuredRenewingSoon.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-8 text-center">No Featured renewals due soon.</p>
        ) : (
          <div className="divide-y divide-charcoal-700/60">
            {featuredRenewingSoon.map(s => (
              <BillingRow key={s.id} s={s} dateLabel="Renews" dateValue={new Date(s.featured_paid_until!).toLocaleDateString('en-GB')} badge={{ label: 'Reminded', className: 'bg-yellow-500/20 text-yellow-400' }} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal-700">
          <h2 className="font-display font-bold text-white flex items-center gap-2">
            <XCircle size={16} className="text-red-400" /> Featured expired
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Still listed, just without the gold boost, until renewed.</p>
        </div>
        {featuredExpired.length === 0 ? (
          <p className="text-gray-500 text-sm px-5 py-8 text-center">No lapsed Featured placements.</p>
        ) : (
          <div className="divide-y divide-charcoal-700/60">
            {featuredExpired.map(s => (
              <BillingRow key={s.id} s={s} dateLabel="Expired" dateValue={new Date(s.featured_paid_until!).toLocaleDateString('en-GB')} badge={{ label: 'Unfeatured', className: 'bg-red-500/20 text-red-400' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LicenseButton({ path }: { path: string }) {
  const [loading, setLoading] = useState(false)

  // Signed on the server now, not here.
  //
  // Minting the link in the browser needed the public anon key to have read
  // access to the whole business-licenses bucket, and that key ships in every
  // page's JavaScript, so it also let anyone else download every business's
  // trade licence. The server signs with the service-role key instead, which
  // lets that public permission be revoked.
  //
  // The popup is opened before the await, because a window.open that happens
  // after one is treated as an unrequested popup and blocked.
  async function getSignedUrl() {
    setLoading(true)
    const tab = window.open('', '_blank')
    try {
      const res = await fetch('/api/admin/business/document-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        if (tab) tab.location.href = data.url
        else window.open(data.url, '_blank')
      } else {
        tab?.close()
        alert(data.error || 'Could not open the document.')
      }
    } catch {
      tab?.close()
      alert('Could not open the document. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Business Document</p>
      <button
        onClick={getSignedUrl}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 transition-colors px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        <FileText size={14} /> {loading ? 'Opening...' : 'View Document PDF'}
      </button>
    </div>
  )
}

function Detail({ label, value, link, highlight }: { label: string; value: string; link?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="text-gold-400 hover:underline text-sm flex items-center gap-1">
          {value} <ExternalLink size={12} />
        </a>
      ) : (
        <p className={`text-sm ${highlight ? 'text-gold-400 font-medium' : 'text-gray-300'}`}>{value}</p>
      )}
    </div>
  )
}
