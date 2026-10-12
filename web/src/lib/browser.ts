/** Copies text, falling back to a hidden textarea where the Clipboard API is unavailable. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy approach */
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}

/** Decodes an image file and re-encodes it as a JPEG data URL no larger than `maxSize` px; `square` crops the centre. */
export async function compressImage(file: File, maxSize = 800, quality = 0.8, square = false): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('decode-failed'))
      image.src = objectUrl
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const [sx, sy, sw, sh] = square
      ? [(img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side]
      : [0, 0, img.naturalWidth, img.naturalHeight]
    const scale = Math.min(1, maxSize / Math.max(sw, sh))
    const width = Math.max(1, Math.round(sw * scale))
    const height = Math.max(1, Math.round(sh * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no-canvas')
    // White background so transparent PNGs don't turn black in JPEG.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
