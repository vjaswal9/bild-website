import { supabase } from './supabase'

// Browser-side half of the signed upload flow.
//
// Asks the server for permission and a one-time link, then sends the file
// straight to Supabase with that link. The file never passes through the
// site's own server, so Vercel's request size cap does not apply and a large
// event video is still fine.
//
// The server chooses the bucket and the path. Nothing here decides where a
// file lands, which is what stops one upload overwriting another's.
export async function uploadViaSignedUrl(opts: {
  kind:
    | 'business-licence'
    | 'business-logo'
    | 'business-banner'
    | 'featured-photo'
    | 'event-flyer'
    | 'event-media'
    | 'testimonial-proof'
  file: File | Blob
  /** Defaults to the file's own type. */
  contentType?: string
  /** A Featured manage token or a document renewal token, where the caller has one. */
  token?: string
  /** Groups event media into a folder per event. */
  eventId?: string
}): Promise<{ path: string; publicUrl: string | null }> {
  const contentType = opts.contentType || (opts.file as File).type || 'application/octet-stream'

  const res = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: opts.kind,
      contentType,
      size: opts.file.size,
      token: opts.token,
      eventId: opts.eventId,
    }),
  })
  const start = await res.json().catch(() => ({}))
  // The server's message is the useful one here: it explains which file types
  // are allowed, or that the file is too big.
  if (!res.ok) throw new Error(start.error || 'Could not start the upload.')

  const { error } = await supabase.storage
    .from(start.bucket)
    .uploadToSignedUrl(start.path, start.uploadToken, opts.file, { contentType })
  if (error) {
    throw new Error('The upload failed. Please check your connection and try again.')
  }

  return { path: start.path, publicUrl: start.publicUrl }
}
