'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pencil, Trash2, Save, X, Loader2, MailWarning, Mail, CheckCircle2, RotateCcw } from 'lucide-react'
import { recoveryOf, describeRecovery } from '@/lib/member-recovery'
import ModalPortal from '@/components/ui/ModalPortal'

export type Member = {
  id: string
  created_at: string
  full_name: string
  email: string
  phone: string | null
  gender: string | null
  location: string | null
  status: string
  paid_at: string | null
  invite_token?: string | null
  invite_opened_at?: string | null
  invite_used_at?: string | null
  abandoned_reminder_sent_at?: string | null
}

const STALE_INVITE_GRACE_MS = 10 * 60 * 1000
// A sign-up only reads as abandoned because it has not paid yet, which is also
// true of someone still on the payment page. An hour is comfortably longer than
// paying takes, so a reminder cannot land in the inbox of a person who is
// finishing their payment. The server enforces the same wait.
const REMINDER_WAIT_MS = 60 * 60 * 1000

// A single-use WhatsApp invite that was opened (page loaded) but never
// actually confirmed (button clicked), well past the time a real person
// would take - usually means an email security scanner (e.g. Outlook/
// Hotmail Safe Links) pre-fetched and silently burned the link before the
// member ever saw the email.
function isStaleInvite(m: Member): boolean {
  return m.status === 'paid' && !!m.invite_token && !!m.invite_opened_at && !m.invite_used_at &&
    Date.now() - new Date(m.invite_opened_at).getTime() > STALE_INVITE_GRACE_MS
}

export default function MembersTable({ members }: { members: Member[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [editing, setEditing] = useState<Member | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [abandonedOnly, setAbandonedOnly] = useState(searchParams.get('abandoned') === '1')
  const [staleInviteOnly, setStaleInviteOnly] = useState(searchParams.get('staleInvite') === '1')
  const [recoveredOnly, setRecoveredOnly] = useState(searchParams.get('recovered') === '1')

  const isAbandoned = (m: Member) => m.status === 'pending'
  const reminderReadyAt = (m: Member) => new Date(new Date(m.created_at).getTime() + REMINDER_WAIT_MS)
  const reminderReady = (m: Member) => Date.now() >= reminderReadyAt(m).getTime()

  const q = search.trim().toLowerCase()
  const base = staleInviteOnly ? members.filter(isStaleInvite)
    : abandonedOnly ? members.filter(isAbandoned)
    : recoveredOnly ? members.filter(m => !!recoveryOf(m))
    : members
  const filtered = q
    ? base.filter(m =>
        [m.full_name, m.email, m.phone, m.gender, m.location, m.status]
          .some(v => (v || '').toLowerCase().includes(q)))
    : base

  async function del(m: Member) {
    if (!confirm(`Delete ${m.full_name} (${m.email})? This permanently removes the member record. This cannot be undone.`)) return
    setDeletingId(m.id)
    const res = await fetch('/api/admin/members/delete', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }),
    })
    if (res.ok) router.refresh()
    else { alert('Could not delete member.'); setDeletingId(null) }
  }

  async function sendReminder(m: Member) {
    if (m.abandoned_reminder_sent_at) {
      const sentOn = new Date(m.abandoned_reminder_sent_at).toLocaleDateString('en-GB')
      if (!confirm(`A reminder email was already sent to ${m.full_name} on ${sentOn}. Send it again?`)) return
    }
    setSendingId(m.id)
    const res = await fetch('/api/admin/members/send-abandoned-reminder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }),
    })
    if (res.ok) router.refresh()
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Could not send reminder email.') }
    setSendingId(null)
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative max-w-md flex-1">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone, emirate..."
            className="w-full px-4 py-2.5 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          {search && <p className="text-gray-500 text-xs mt-1.5">{filtered.length} of {members.length}</p>}
        </div>
        <button
          onClick={() => { setAbandonedOnly(v => !v); setStaleInviteOnly(false); setRecoveredOnly(false) }}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0 ${
            abandonedOnly ? 'bg-orange-500 text-white' : 'bg-charcoal-800 border border-charcoal-700 text-gray-400 hover:text-white'
          }`}
        >
          {abandonedOnly ? 'Showing abandoned only' : 'Show abandoned only'}
        </button>
        <button
          onClick={() => { setStaleInviteOnly(v => !v); setAbandonedOnly(false); setRecoveredOnly(false) }}
          title="An invite link that was opened but never confirmed - often an email scanner (e.g. Outlook Safe Links) silently burning the link"
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0 ${
            staleInviteOnly ? 'bg-orange-500 text-white' : 'bg-charcoal-800 border border-charcoal-700 text-gray-400 hover:text-white'
          }`}
        >
          {staleInviteOnly ? 'Showing stale invites only' : 'Show stale invites only'}
        </button>
        <button
          onClick={() => { setRecoveredOnly(v => !v); setAbandonedOnly(false); setStaleInviteOnly(false) }}
          title="Members who started joining, left without paying, and came back later to pay"
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0 ${
            recoveredOnly ? 'bg-teal-600 text-white' : 'bg-charcoal-800 border border-charcoal-700 text-gray-400 hover:text-white'
          }`}
        >
          {recoveredOnly ? 'Showing recovered only' : 'Show recovered only'}
        </button>
      </div>

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
              <th className="px-5 py-3 font-medium">Started</th>
              <th className="px-5 py-3 font-medium">Paid</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} className="border-b border-charcoal-700/60 hover:bg-charcoal-700/40">
                <td className="px-5 py-3 text-white font-medium">
                  <Link href={`/admin/members/${m.id}`} className="hover:text-gold-500 hover:underline" title="View full profile">
                    {m.full_name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-gray-400">{m.email}</td>
                <td className="px-5 py-3 text-gray-400">{m.phone || '-'}</td>
                <td className="px-5 py-3 text-gray-400 capitalize">{m.gender || '-'}</td>
                <td className="px-5 py-3 text-gray-400">{m.location || '-'}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      m.status === 'paid' ? 'bg-green-500/20 text-green-400'
                      : m.status === 'imported' ? 'bg-blue-500/20 text-blue-300'
                      : isAbandoned(m) ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {isAbandoned(m) ? 'abandoned' : m.status}
                    </span>
                    {(() => {
                      const r = recoveryOf(m)
                      return r ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300"
                          title={describeRecovery(r)}
                        >
                          <RotateCcw size={11} /> recovered{r.afterReminder ? ' after reminder' : ''}
                        </span>
                      ) : null
                    })()}
                    {isStaleInvite(m) && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400"
                        title="Invite link opened but never confirmed - likely an email scanner (e.g. Outlook Safe Links) silently burned the link before they saw it"
                      >
                        <MailWarning size={11} /> invite stalled
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {new Date(m.created_at).toLocaleDateString('en-GB')} {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{m.paid_at ? new Date(m.paid_at).toLocaleDateString('en-GB') : '-'}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {isAbandoned(m) && (
                      m.abandoned_reminder_sent_at ? (
                        <button
                          onClick={() => sendReminder(m)}
                          disabled={sendingId === m.id}
                          className="p-2 text-green-400 hover:text-green-300 disabled:opacity-50"
                          title={`Reminder email sent on ${new Date(m.abandoned_reminder_sent_at).toLocaleDateString('en-GB')} ${new Date(m.abandoned_reminder_sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - click to send again`}
                        >
                          {sendingId === m.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                        </button>
                      ) : reminderReady(m) ? (
                        <button
                          onClick={() => sendReminder(m)}
                          disabled={sendingId === m.id}
                          className="p-2 text-gray-400 hover:text-gold-500 disabled:opacity-50"
                          title="Send reminder email"
                        >
                          {sendingId === m.id ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                        </button>
                      ) : (
                        <span
                          className="p-2 text-gray-700"
                          title={`They may still be paying. Available from ${reminderReadyAt(m).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                        >
                          <Mail size={15} />
                        </span>
                      )
                    )}
                    <button onClick={() => setEditing(m)} className="p-2 text-gray-400 hover:text-white" title="Edit"><Pencil size={15} /></button>
                    <button onClick={() => del(m)} disabled={deletingId === m.id} className="p-2 text-gray-400 hover:text-red-400 disabled:opacity-50" title="Delete">
                      {deletingId === m.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <EditModal member={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function EditModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: member.full_name || '',
    email: member.email || '',
    phone: member.phone || '',
    gender: member.gender || '',
    location: member.location || '',
    status: member.status || 'pending',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    setError(''); setSaving(true)
    const res = await fetch('/api/admin/members/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: member.id, ...form }),
    })
    if (res.ok) { router.refresh(); onClose() }
    else { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not save.'); setSaving(false) }
  }

  return (
    <ModalPortal onClose={onClose}>
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-charcoal-800 border border-charcoal-700 rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
          <h3 className="font-display text-xl font-bold text-white mb-5">Edit member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name" value={form.full_name} onChange={v => set('full_name', v)} />
            <Field label="Email" value={form.email} onChange={v => set('email', v)} />
            <Field label="Phone" value={form.phone} onChange={v => set('phone', v)} />
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Gender</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500">
                <option value="">-</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <Field label="Emirate" value={form.location} onChange={v => set('location', v)} />
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500">
                <option value="paid">paid</option>
                <option value="pending">pending</option>
                <option value="imported">imported</option>
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <div className="flex gap-2 mt-6">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose} disabled={saving} className="inline-flex items-center gap-2 bg-charcoal-700 hover:bg-charcoal-600 text-gray-300 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
              <X size={16} /> Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500" />
    </div>
  )
}
