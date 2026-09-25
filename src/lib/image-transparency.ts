// Works out whether an image can have transparent pixels, so a banner can be
// shown on white rather than on a dark blurred backdrop. A logo exported with
// its background removed looks wrong on dark: the blurred fill shows straight
// through it.
//
// This runs on the server on purpose. Several banners are hotlinked from other
// websites that send no CORS headers, so reading the pixels in the browser
// (canvas) would be blocked for exactly the images that need checking.
// Only the first few KB are needed, since every format declares alpha in its
// header.

const HEAD_BYTES = 4096

function pngHasAlpha(buf: Buffer): boolean {
  // IHDR colour type sits at byte 25. 4 = grey+alpha, 6 = RGBA.
  const colourType = buf[25]
  if (colourType === 4 || colourType === 6) return true
  // Palette images (3) are transparent only if a tRNS chunk is present.
  if (colourType === 3) return buf.includes(Buffer.from('tRNS'))
  return false
}

function webpHasAlpha(buf: Buffer): boolean {
  // Extended format flags alpha in the VP8X chunk; lossless (VP8L) can carry it.
  if (buf.includes(Buffer.from('ALPH'))) return true
  const vp8x = buf.indexOf(Buffer.from('VP8X'))
  if (vp8x !== -1) return (buf[vp8x + 8] & 0x10) !== 0
  return buf.includes(Buffer.from('VP8L'))
}

/**
 * True when the image may contain transparent pixels.
 * Returns false on any error, so an unreachable image keeps the existing
 * dark treatment rather than flipping to white unexpectedly.
 */
export async function imageHasTransparency(url?: string | null): Promise<boolean> {
  if (!url) return false
  if (/\.svg(\?|$)/i.test(url)) return true          // SVGs are transparent unless painted
  if (/\.(jpe?g)(\?|$)/i.test(url)) return false     // JPEG has no alpha channel at all

  try {
    const res = await fetch(url, {
      headers: {
        // Some hosts reject requests that do not look like a browser.
        'User-Agent': 'Mozilla/5.0 (compatible; BILDBot/1.0)',
        Range: `bytes=0-${HEAD_BYTES - 1}`,
      },
      // Banner images effectively never change at a given URL.
      next: { revalidate: 86400 },
    })
    if (!res.ok && res.status !== 206) return false
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32) return false

    const isPng = buf[0] === 0x89 && buf[1] === 0x50
    if (isPng) return pngHasAlpha(buf)
    if (buf.slice(8, 12).toString() === 'WEBP') return webpHasAlpha(buf)
    if (buf[0] === 0xff && buf[1] === 0xd8) return false   // JPEG
    return false
  } catch {
    return false
  }
}
