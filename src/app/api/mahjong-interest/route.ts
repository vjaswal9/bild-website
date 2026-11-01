import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getClientIp, isRateLimitedShared } from '@/lib/rate-limit'
import { str, oneOf } from '@/lib/validate'
import { whatsappDigits } from '@/lib/private-link-format'
import { sendMahjongInterestAdminAlert } from '@/lib/email'
import { reportError } from '@/lib/report-error'
import { SHOW_MAHJONG_INTEREST } from '@/lib/site-flags'
import {
  MAHJONG_AREAS, MAHJONG_EXPERIENCE_OPTIONS, MAHJONG_MEMBER_OPTIONS, MAHJONG_NOTES_MAX, MAHJONG_TIMES,
} from '@/lib/mahjong-interest'

export const dynamic = 'force-dynamic'

const memberValues = MAHJONG_MEMBER_OPTIONS.map(o => o.value)
const experienceValues = MAHJONG_EXPERIENCE_OPTIONS.map(o => o.value)

// Public: register interest in BILD Mahjong classes and socials.
export async function POST(req: NextRequest) {
  if (!SHOW_MAHJONG_INTEREST) return NextResponse.json({ error: 'Registration is closed.' }, { status: 404 })

  // Generous on purpose: people scan the flyer together at events, often on one
  // venue Wi-Fi, and so share a single address.
  if (await isRateLimitedShared(`mahjong:${getClientIp(req)}`, { windowMs: 10 * 60 * 1000, max: 40 })) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>))

  // A hidden field no person sees. A bot that fills in every field fills this
  // one too, and is told it worked so it has nothing to learn from.
  if (str(b.website, 100)) return NextResponse.json({ ok: true })

  const fullName = str(b.fullName, 120)
  const whatsapp = str(b.whatsapp, 40)
  const digits = whatsappDigits(whatsapp)
  const memberStatus = oneOf<string>(b.memberStatus, memberValues, '')
  const area = oneOf<string>(b.area, MAHJONG_AREAS, '')
  const experience = oneOf<string>(b.experience, experienceValues, '')
  const availability = MAHJONG_TIMES.filter(t => Array.isArray(b.availability) && b.availability.includes(t))
  const notes = str(b.notes, MAHJONG_NOTES_MAX)

  if (!fullName) return NextResponse.json({ error: 'Please give your full name.' }, { status: 400 })
  if (!digits || digits.length > 15 || /[^\d+\s()\-.]/.test(whatsapp)) {
    return NextResponse.json({ error: 'Please check your WhatsApp number and include the country code, for example +971 50 123 4567.' }, { status: 400 })
  }
  if (!memberStatus) return NextResponse.json({ error: 'Please tell us whether you are a BILD member.' }, { status: 400 })
  if (!area) return NextResponse.json({ error: 'Please choose the area that would suit you best.' }, { status: 400 })
  if (!experience) return NextResponse.json({ error: 'Please tell us about your Mahjong experience.' }, { status: 400 })
  if (availability.length === 0) return NextResponse.json({ error: 'Please choose at least one time that could suit you.' }, { status: 400 })
  if (b.consent !== true) return NextResponse.json({ error: 'Please tick the box to agree that we may contact you.' }, { status: 400 })

  // Look first, then insert or update: a second sign-up from the same number
  // refreshes the first rather than adding a duplicate.
  const { data: existing } = await supabaseAdmin
    .from('mahjong_interest')
    .select('id')
    .eq('whatsapp_digits', digits)
    .maybeSingle()

  const fields = {
    full_name: fullName,
    whatsapp,
    whatsapp_digits: digits,
    member_status: memberStatus,
    area,
    experience,
    availability,
    notes: notes || null,
  }

  const { error } = existing
    ? await supabaseAdmin.from('mahjong_interest').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await supabaseAdmin.from('mahjong_interest').insert([{ ...fields, consented_at: new Date().toISOString() }])

  if (error) {
    reportError('Mahjong interest write failed:', error)
    return NextResponse.json({ error: 'We could not save your details. Please try again in a moment.' }, { status: 500 })
  }

  const { count } = await supabaseAdmin.from('mahjong_interest').select('id', { count: 'exact', head: true })
  await sendMahjongInterestAdminAlert({
    name: fullName, whatsapp, memberStatus, area, experience, availability, notes: notes || undefined,
    total: count ?? 0, repeat: !!existing,
  })

  return NextResponse.json({ ok: true })
}
