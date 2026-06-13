import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, Clock } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import PageHero from '@/components/ui/PageHero'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const metadata: Metadata = { title: 'Welcome to BILD' }
export const dynamic = 'force-dynamic'

export default async function JoinSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams

  type M = { full_name: string; status: string; invite_token: string }
  let member: M | null = null
  if (session_id) {
    const { data } = await supabaseAdmin
      .from('members')
      .select('full_name, status, invite_token')
      .eq('stripe_session_id', session_id)
      .maybeSingle()
    member = (data as M | null) ?? null
  }

  const paid = member?.status === 'paid'

  return (
    <>
      <PageHero title="Welcome to BILD" subtitle="Your people, your place, your Dubai family" />
      <div className="py-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          {paid ? (
            <>
              <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-gold-500" />
              </div>
              <h2 className="font-display text-3xl font-bold text-charcoal-800 mb-3">
                You&apos;re in{member?.full_name ? `, ${member.full_name.split(' ')[0]}` : ''}! 🎉
              </h2>
              <p className="text-charcoal-600 mb-8">
                Your 50 AED lifetime membership is confirmed. One last step — tap below to join your BILD WhatsApp group.
                This link is single-use and just for you.
              </p>
              <a
                href={`/j/${member!.invite_token}`}
                className="inline-flex items-center gap-2 bg-[#25D366] text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-[#1da851] transition-all"
              >
                <FaWhatsapp size={22} /> Join your BILD WhatsApp group
              </a>
              <p className="text-xs text-charcoal-400 mt-4">
                The link expires in 48 hours and can only be used once. Trouble joining?{' '}
                <a href="mailto:connect@bild.ae" className="text-gold-600 hover:underline">Contact us</a>.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock size={40} className="text-gold-500" />
              </div>
              <h2 className="font-display text-3xl font-bold text-charcoal-800 mb-3">Confirming your payment…</h2>
              <p className="text-charcoal-600 mb-6">
                Thanks for joining BILD! We&apos;re just confirming your payment — this can take a few seconds.
                Refresh this page shortly to get your WhatsApp group link.
              </p>
              <Link href="/join/success" className="text-gold-600 hover:underline font-medium">Refresh</Link>
            </>
          )}
        </div>
      </div>
    </>
  )
}
