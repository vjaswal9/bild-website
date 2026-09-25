// Client-side image downscale + compress before upload. Keeps files small so
// they load fast and use little storage, with no visible quality loss.
// Non-images (and GIFs, to preserve animation) pass through unchanged.

export async function compressImage(
  file: File,
  maxDim = 1920,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  let img: HTMLImageElement
  try {
    img = await loadImage(file)
  } catch {
    return file // if it can't be read as an image, upload the original
  }

  const { width, height } = img
  // Already small enough - don't bother re-encoding.
  if (width <= maxDim && height <= maxDim && file.size < 500 * 1024) return file

  const scale = Math.min(1, maxDim / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, w, h)

  // Prefer WebP (smaller); fall back to JPEG if the browser can't encode it.
  const blob =
    (await toBlob(canvas, 'image/webp', quality)) ??
    (await toBlob(canvas, 'image/jpeg', quality))
  if (!blob || blob.size >= file.size) return file // never make it bigger

  const ext = blob.type === 'image/webp' ? '.webp' : '.jpg'
  const name = file.name.replace(/\.[^.]+$/, '') + ext
  return new File([blob], name, { type: blob.type })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}
