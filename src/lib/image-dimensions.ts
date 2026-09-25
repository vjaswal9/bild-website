// Reads an image file's pixel dimensions in the browser, without uploading it.
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
}

// Returns a warning message if the image isn't (close enough to) square, or
// null if it's fine. Used to nudge logo uploads toward a square crop, since
// directory cards display logos in a square frame.
export function squareWarning(width: number, height: number): string | null {
  if (!width || !height) return null
  const ratio = width / height
  if (Math.abs(ratio - 1) <= 0.05) return null // within 5% - close enough
  return `This image is ${width}×${height}px, not square. It may look cropped or stretched on the directory card - a square image (e.g. 500×500) works best.`
}
