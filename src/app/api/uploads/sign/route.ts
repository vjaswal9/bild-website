import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'
import { str } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// Issues a one-time, pre-authorised upload link.
//
// Every upload on the site used to go straight from the browser to Supabase
// using the public anon key, which needed storage policies granting `anon`
// INSERT on four buckets. The anon key ships in every page's JavaScript, so
// those policies were effectively open to the internet: anyone could write
// files of any size and type into BILD's storage, on BILD's quota, and serve
// them from a bild.ae-adjacent URL.
//
// Now the server decides. It checks who is asking, then picks the bucket, the
// path and the file extension itself and hands back a signed token that is
// good for exactly that one path. A signed upload is pre-authorised, so the
// anon INSERT policies can be dropped entirely.
//
// The client never chooses where a file lands. That is the whole point: a
// client-supplied path is how one business overwrites another's logo.

type Kind =
  | 'business-licence'
  | 'business-logo'
  | 'business-banner'
  | 'featured-photo'
  | 'event-flyer'
  | 'event-media'
  | 'testimonial-proof'

// 'business-token' is any approved business holding its manage link.
// 'featured-token' is the narrower case of one whose Featured is paid up.
type Auth = 'admin' | 'featured-token' | 'business-token' | 'renewal-token' | 'public'

const MB = 1024 * 1024

const KINDS: Record<Kind, {
  bucket: string
  prefix: string
  maxBytes: number
  types: Record<string, string>   // allowed content type -> extension
  auth: Auth[]
  isPublicBucket: boolean
}> = {
  'business-licence': {
    bucket: 'business-licenses',
    prefix: '',
    maxBytes: 10 * MB,
    types: { 'application/pdf': 'pdf' },
    auth: ['public', 'renewal-token', 'admin'],
    isPublicBucket: false,
  },
  'business-logo': {
    bucket: 'business-logos',
    prefix: '',
    maxBytes: 5 * MB,
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    auth: ['public', 'admin', 'featured-token'],
    isPublicBucket: true,
  },
  'business-banner': {
    bucket: 'business-logos',
    prefix: 'banner-',
    maxBytes: 8 * MB,
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    auth: ['public', 'admin', 'featured-token'],
    isPublicBucket: true,
  },
  'featured-photo': {
    bucket: 'business-logos',
    prefix: 'featured-',
    maxBytes: 5 * MB,
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    auth: ['featured-token', 'admin'],
    isPublicBucket: true,
  },
  'event-flyer': {
    bucket: 'event-flyers',
    prefix: '',
    maxBytes: 8 * MB,
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    auth: ['admin'],
    isPublicBucket: true,
  },
  'testimonial-proof': {
    // A screenshot of the customer's original email, WhatsApp or text, sent so
    // an admin can check the testimonial is real. Private bucket: it is
    // somebody's private message and is never shown to visitors.
    bucket: 'testimonial-proof',
    prefix: '',
    maxBytes: 10 * MB,
    types: {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/heic': 'heic', 'application/pdf': 'pdf',
    },
    auth: ['business-token', 'admin'],
    isPublicBucket: false,
  },
  'event-media': {
    bucket: 'event-media',
    // Videos are genuinely large and the upload goes browser to Supabase
    // directly, so Vercel's request size cap does not apply here.
    prefix: '',
    maxBytes: 500 * MB,
    types: {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
    },
    auth: ['admin'],
    isPublicBucket: true,
  },
}

// Every way of proving you may upload that the caller currently holds.
//
// Deliberately a list rather than one answer. A Featured business is also an
// approved business, and returning only the narrower 'featured-token' meant it
// was refused for anything asking for 'business-token' - which refused exactly
// the businesses most likely to use the testimonials form.
async function authorise(req: NextRequest, token: string, eventId: string): Promise<Auth[]> {
  if (await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return ['admin']

  const grants: Auth[] = []

  if (token) {
    const { data: biz } = await supabaseAdmin
      .from('business_submissions')
      .select('id, status, delisted_at, featured, featured_paid_until, featured_manage_token, renewal_token, renewal_token_expires_at')
      .or(`featured_manage_token.eq.${token},renewal_token.eq.${token}`)
      .maybeSingle()

    if (biz) {
      const live = biz.status === 'approved' && !biz.delisted_at

      // The manage token identifies an approved business whether or not it has
      // ever paid for Featured. That is what lets any approved business send
      // in a testimonial.
      if (live && biz.featured_manage_token === token) {
        grants.push('business-token')

        // Featured is the narrower grant on top, and only while it is paid up.
        const featuredActive = biz.featured &&
          (biz.featured_paid_until == null || new Date(biz.featured_paid_until) >= new Date())
        if (featuredActive) grants.push('featured-token')
      }

      // A renewal token only counts before it expires.
      if (biz.renewal_token === token) {
        const expiry = biz.renewal_token_expires_at
        if (!expiry || new Date(expiry) >= new Date()) grants.push('renewal-token')
      }
    }
  }
  if (grants.length) return grants

  // Anyone can submit a business to the directory, so that one flow has to be
  // open. It is rate limited by IP instead, and still constrained to one
  // bucket, one extension and a size cap.
  void eventId
  return ['public']
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (isRateLimited(`upload-sign:${ip}`, { windowMs: 10 * 60 * 1000, max: 40 })) {
    return NextResponse.json({ error: 'Too many uploads. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const kind = str(body.kind, 40) as Kind
  const spec = KINDS[kind]
  if (!spec) return NextResponse.json({ error: 'Unknown upload type.' }, { status: 400 })

  const contentType = str(body.contentType, 100).toLowerCase()
  const ext = spec.types[contentType]
  if (!ext) {
    const allowed = Object.values(spec.types).join(', ')
    return NextResponse.json({ error: `That file type is not allowed here. Please upload: ${allowed}.` }, { status: 400 })
  }

  const size = Number(body.size)
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'That file appears to be empty.' }, { status: 400 })
  }
  if (size > spec.maxBytes) {
    return NextResponse.json(
      { error: `That file is over ${Math.round(spec.maxBytes / MB)} MB. Please compress it and try again.` },
      { status: 400 },
    )
  }

  const token = str(body.token, 100)
  const eventId = str(body.eventId, 60)
  const grants = await authorise(req, token, eventId)
  if (!spec.auth.some(allowed => grants.includes(allowed))) {
    return NextResponse.json({ error: 'You are not allowed to upload this.' }, { status: 403 })
  }

  // The path is ours. A random name means an upload can never overwrite an
  // existing file, and nothing the caller sends is interpolated into it.
  const folder = kind === 'event-media' && /^[0-9a-f-]{36}$/i.test(eventId) ? `${eventId}/` : ''
  const path = `${folder}${spec.prefix}${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from(spec.bucket).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('Could not create a signed upload URL:', error)
    return NextResponse.json({ error: 'Could not start the upload. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({
    bucket: spec.bucket,
    path: data.path,
    uploadToken: data.token,
    // Given back so the browser does not have to build it, and so the private
    // licences bucket never gets a public URL by accident.
    publicUrl: spec.isPublicBucket
      ? supabaseAdmin.storage.from(spec.bucket).getPublicUrl(data.path).data.publicUrl
      : null,
  })
}
