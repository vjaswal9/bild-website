import sharp, { type OverlayOptions } from 'sharp'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePublic, EVENT_PATHS, directoryPaths, RevalidateTarget } from '@/lib/revalidate-public'

// Automatic alcohol check on public photos.
//
// BILD is a UAE-licensed events organiser, and showing bottles, labels or a
// liquor shelf in public photos can read as advertising alcohol. This looks at
// every public image (event galleries and directory images), asks Claude to
// point at anything that looks like that, and leaves the decision to an admin:
// nothing is ever blurred or changed without a click on the review page.
//
// It is a safety net, not a guarantee. The model can miss a bottle and its
// boxes are approximate, which is why the admin sees a preview and picks which
// areas to blur.

export type Region = {
  x0: number; y0: number; x1: number; y1: number   // 0..1 fractions of the image
  kind: 'bottle' | 'glass'
  label: string
}

export type ImageSource = 'event_gallery' | 'business_logo' | 'business_banner' | 'business_featured'

export type ImageCheckRow = {
  id: string
  url: string
  source: ImageSource
  ref_id: string | null
  ref_label: string | null
  status: 'pending' | 'clear' | 'flagged' | 'blurred' | 'kept' | 'error'
  regions: Region[]
  reason: string | null
  error: string | null
  blurred_url: string | null
  original_path: string | null
}

const PUBLIC_MARK = '/storage/v1/object/public/'
const MODEL = process.env.ANTHROPIC_IMAGE_CHECK_MODEL || 'claude-sonnet-5-5'
const MAX_SIDE = 1568   // the largest the model looks at; bigger only costs more

export function imageCheckConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

// Only our own storage can be checked and replaced. A link to somebody else's
// site is not ours to blur.
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const i = url.indexOf(PUBLIC_MARK)
  if (i === -1) return null
  const rest = url.slice(i + PUBLIC_MARK.length).split('?')[0]
  const slash = rest.indexOf('/')
  if (slash === -1) return null
  return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) }
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Could not download the image (HTTP ${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

const PROMPT = (w: number, h: number) => `You are checking one photo from a community events website in the UAE before it is shown publicly. The site must not look like it is advertising alcohol.

The image is ${w} x ${h} pixels. Find every place that shows alcohol and return a tight bounding box in PIXELS (origin top-left) for each.

Two kinds of box:
- "bottle": bottles, cans or kegs of alcohol, anything with a visible alcohol brand or label, liquor or wine shelves, wine or drinks fridges, ice buckets holding bottles, bar back-shelves of spirits. Include a bottle even if it is small, held in a hand, or out of focus.
- "glass": a glass that clearly holds an alcoholic drink (beer, wine, champagne, spirits). Do not box plain water, juice, soft drinks or mocktails, and do not box a glass if you cannot tell.

Rules:
- Boxes must be tight around the object. Never include anybody's face; if a bottle is in front of a face, box only the bottle.
- If a person is only holding or standing near the item, still box only the item.
- If the photo shows no alcohol at all, return an empty list.

Reply with JSON only, no other text:
{"regions":[{"x0":0,"y0":0,"x1":0,"y1":0,"kind":"bottle","label":"beer bottle, held in hand"}],"reason":"one short sentence"}`

type ModelAnswer = { regions: Region[]; reason: string }

async function askModel(jpeg: Buffer, w: number, h: number): Promise<ModelAnswer> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
          { type: 'text', text: PROMPT(w, h) },
        ],
      }],
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Image check API error ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const text: string = (data?.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('The image check returned no readable answer')
  const parsed = JSON.parse(match[0])

  const regions: Region[] = []
  for (const r of Array.isArray(parsed.regions) ? parsed.regions : []) {
    const x0 = Math.max(0, Math.min(w, Number(r.x0)))
    const y0 = Math.max(0, Math.min(h, Number(r.y0)))
    const x1 = Math.max(0, Math.min(w, Number(r.x1)))
    const y1 = Math.max(0, Math.min(h, Number(r.y1)))
    if (![x0, y0, x1, y1].every(Number.isFinite)) continue
    // Ignore specks and boxes that swallow most of the picture - those are
    // the model guessing, and blurring them would wreck the photo.
    const fw = (x1 - x0) / w, fh = (y1 - y0) / h
    if (fw < 0.01 || fh < 0.01 || fw * fh > 0.45) continue
    regions.push({
      x0: x0 / w, y0: y0 / h, x1: x1 / w, y1: y1 / h,
      kind: r.kind === 'glass' ? 'glass' : 'bottle',
      label: String(r.label || (r.kind === 'glass' ? 'glass' : 'bottle')).slice(0, 80),
    })
  }
  return { regions, reason: String(parsed.reason || '').slice(0, 300) }
}

// Looks at one image and records the result. Never throws: a failure is stored
// on the row so one bad file cannot stall the whole run.
export async function scanImage(row: Pick<ImageCheckRow, 'id' | 'url'>): Promise<'clear' | 'flagged' | 'error'> {
  try {
    const original = await download(row.url)
    const { data, info } = await sharp(original)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true })

    const answer = await askModel(data, info.width, info.height)
    // A photo is only raised for review when something bottle-like shows. A
    // glass on its own is routine at a social event, so those boxes are kept
    // as optional extras on photos that are flagged anyway.
    const flagged = answer.regions.some(r => r.kind === 'bottle')
    const status = flagged ? 'flagged' : 'clear'
    await supabaseAdmin.from('image_checks').update({
      status,
      regions: flagged ? answer.regions : [],
      reason: answer.reason || null,
      error: null,
      checked_at: new Date().toISOString(),
    }).eq('id', row.id)
    return status
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabaseAdmin.from('image_checks').update({
      status: 'error', error: msg.slice(0, 300), checked_at: new Date().toISOString(),
    }).eq('id', row.id)
    return 'error'
  }
}

// Registers every public image that has not been looked at yet.
export async function registerNewImages(): Promise<number> {
  type Found = { url: string; source: ImageSource; ref_id: string; ref_label: string }
  const found: Found[] = []

  const { data: events } = await supabaseAdmin.from('events').select('id, title, gallery')
  for (const e of events || []) {
    for (const g of (e.gallery || []) as { url: string; type: string }[]) {
      if (g.type === 'image' && g.url) found.push({ url: g.url, source: 'event_gallery', ref_id: e.id, ref_label: e.title })
    }
  }

  const { data: biz } = await supabaseAdmin
    .from('business_submissions')
    .select('id, business_name, logo_url, banner_url, featured_gallery_urls')
    .eq('status', 'approved')
    .is('delisted_at', null)
  for (const b of biz || []) {
    if (b.logo_url) found.push({ url: b.logo_url, source: 'business_logo', ref_id: b.id, ref_label: b.business_name })
    if (b.banner_url) found.push({ url: b.banner_url, source: 'business_banner', ref_id: b.id, ref_label: b.business_name })
    for (const u of (b.featured_gallery_urls || []) as string[]) {
      if (u) found.push({ url: u, source: 'business_featured', ref_id: b.id, ref_label: b.business_name })
    }
  }

  const ours = found.filter(f => f.url.includes(PUBLIC_MARK))
  if (ours.length === 0) return 0

  const { data: known } = await supabaseAdmin.from('image_checks').select('url').in('url', ours.map(f => f.url))
  const have = new Set((known || []).map(k => k.url))
  const fresh = ours.filter((f, i) => !have.has(f.url) && ours.findIndex(o => o.url === f.url) === i)
  if (fresh.length === 0) return 0

  await supabaseAdmin.from('image_checks').upsert(
    fresh.map(f => ({ ...f, status: 'pending' })),
    { onConflict: 'url', ignoreDuplicates: true },
  )
  return fresh.length
}

// Scans up to `limit` waiting images, a few at a time.
export async function scanPending(limit: number): Promise<{ scanned: number; flagged: number; errors: number; remaining: number }> {
  await registerNewImages()
  const { data: rows } = await supabaseAdmin
    .from('image_checks').select('id, url').eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(limit)

  let flagged = 0, errors = 0
  const queue = [...(rows || [])]
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const r = await scanImage(row)
      if (r === 'flagged') flagged++
      if (r === 'error') errors++
    }
  }
  await Promise.all([worker(), worker(), worker()])

  const { count } = await supabaseAdmin
    .from('image_checks').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return { scanned: (rows || []).length, flagged, errors, remaining: count || 0 }
}

// Blurs the chosen regions and returns the new file in the same format.
export async function blurRegions(original: Buffer, regions: Region[]): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const meta = await sharp(original).metadata()
  const format = meta.format === 'png' ? 'png' : meta.format === 'webp' ? 'webp' : 'jpeg'
  // rotate() bakes in the camera's orientation so the boxes line up.
  const { data: base, info } = await sharp(original).rotate().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height
  const pad = Math.round(0.012 * W)

  const overlays: OverlayOptions[] = []
  for (const r of regions) {
    const left = Math.max(0, Math.floor(r.x0 * W) - pad)
    const top = Math.max(0, Math.floor(r.y0 * H) - pad)
    const right = Math.min(W, Math.ceil(r.x1 * W) + pad)
    const bottom = Math.min(H, Math.ceil(r.y1 * H) + pad)
    const w = right - left, h = bottom - top
    if (w < 4 || h < 4) continue

    const sigma = Math.max(10, Math.min(Math.min(w, h) * 0.28, 0.025 * W)) * 1.4
    const mask = await sharp(Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="${pad}" y="${pad}" width="${Math.max(1, w - 2 * pad)}" height="${Math.max(1, h - 2 * pad)}" fill="#fff"/></svg>`,
    )).blur(Math.max(0.5, pad * 0.6)).png().toBuffer()

    const softened = await sharp(base)
      .extract({ left, top, width: w, height: h })
      .blur(sigma)
      .ensureAlpha()
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer()
    overlays.push({ input: softened, left, top })
  }

  const pipeline = sharp(base).composite(overlays)
  if (format === 'png') return { buffer: await pipeline.png().toBuffer(), contentType: 'image/png', ext: 'png' }
  if (format === 'webp') return { buffer: await pipeline.webp({ quality: 90 }).toBuffer(), contentType: 'image/webp', ext: 'webp' }
  return { buffer: await pipeline.jpeg({ quality: 90 }).toBuffer(), contentType: 'image/jpeg', ext: 'jpg' }
}

// Points whatever shows the image at the new file. Returns false when nothing
// uses the old one any more (it was removed while the admin was reviewing).
async function swapReference(row: ImageCheckRow, oldUrl: string, newUrl: string): Promise<{ ok: boolean; revalidate: RevalidateTarget[] }> {
  if (row.source === 'event_gallery') {
    const { data: ev } = await supabaseAdmin.from('events').select('id, gallery').eq('id', row.ref_id).maybeSingle()
    const gallery = (ev?.gallery || []) as { url: string }[]
    if (!gallery.some(g => g.url === oldUrl)) return { ok: false, revalidate: [] }
    const next = gallery.map(g => (g.url === oldUrl ? { ...g, url: newUrl } : g))
    const { error } = await supabaseAdmin.from('events').update({ gallery: next }).eq('id', row.ref_id)
    if (error) throw new Error(error.message)
    return { ok: true, revalidate: [...EVENT_PATHS, '/photo-vault', { path: '/events/[slug]', type: 'page' }] }
  }

  const { data: b } = await supabaseAdmin
    .from('business_submissions').select('id, logo_url, banner_url, featured_gallery_urls').eq('id', row.ref_id).maybeSingle()
  if (!b) return { ok: false, revalidate: [] }
  let patch: Record<string, unknown> | null = null
  if (row.source === 'business_logo' && b.logo_url === oldUrl) patch = { logo_url: newUrl }
  if (row.source === 'business_banner' && b.banner_url === oldUrl) patch = { banner_url: newUrl }
  if (row.source === 'business_featured' && (b.featured_gallery_urls || []).includes(oldUrl)) {
    patch = { featured_gallery_urls: (b.featured_gallery_urls as string[]).map(u => (u === oldUrl ? newUrl : u)) }
  }
  if (!patch) return { ok: false, revalidate: [] }
  const { error } = await supabaseAdmin.from('business_submissions').update(patch).eq('id', row.ref_id)
  if (error) throw new Error(error.message)
  return { ok: true, revalidate: directoryPaths() }
}

// Blurs the picked regions of a flagged image, swaps it in everywhere it was
// used, and moves the untouched original into a private bucket.
export async function applyBlur(row: ImageCheckRow, picked: Region[]): Promise<void> {
  const loc = parseStorageUrl(row.url)
  if (!loc) throw new Error('This image is not stored on BILD storage, so it cannot be blurred here.')
  if (picked.length === 0) throw new Error('Pick at least one area to blur.')

  const original = await download(row.url)
  const { buffer, contentType, ext } = await blurRegions(original, picked)

  const stem = loc.path.replace(/\.[^./]+$/, '')
  const newPath = `${stem}-blur${Date.now().toString(36)}.${ext}`
  const up = await supabaseAdmin.storage.from(loc.bucket).upload(newPath, buffer, { contentType, upsert: false })
  if (up.error) throw new Error(`Could not save the blurred copy: ${up.error.message}`)
  const newUrl = supabaseAdmin.storage.from(loc.bucket).getPublicUrl(newPath).data.publicUrl

  let swapped
  try {
    swapped = await swapReference(row, row.url, newUrl)
  } catch (e) {
    await supabaseAdmin.storage.from(loc.bucket).remove([newPath])
    throw e
  }
  if (!swapped.ok) {
    await supabaseAdmin.storage.from(loc.bucket).remove([newPath])
    await supabaseAdmin.from('image_checks').update({ status: 'kept', reason: 'Image was removed before review', reviewed_at: new Date().toISOString() }).eq('id', row.id)
    throw new Error('That image is no longer used anywhere, so there was nothing to change.')
  }

  // Keep the untouched original out of public view but recoverable.
  const originalPath = `${loc.bucket}/${loc.path}`
  const held = await supabaseAdmin.storage.from('image-originals').upload(originalPath, original, {
    contentType: contentType, upsert: true,
  })
  if (!held.error) await supabaseAdmin.storage.from(loc.bucket).remove([loc.path])

  const now = new Date().toISOString()
  await supabaseAdmin.from('image_checks').update({
    status: 'blurred', blurred_url: newUrl, original_path: held.error ? null : originalPath, reviewed_at: now,
  }).eq('id', row.id)
  // The blurred copy is already dealt with; do not scan it again.
  await supabaseAdmin.from('image_checks').upsert({
    url: newUrl, source: row.source, ref_id: row.ref_id, ref_label: row.ref_label,
    status: 'clear', reason: 'Blurred copy', checked_at: now,
  }, { onConflict: 'url' })

  revalidatePublic(swapped.revalidate)
}
