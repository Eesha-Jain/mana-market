const DEFAULT_MAX_EDGE = 1600;
const JPEG_QUALITY = 0.88;

function ocrMaxEdge(): number {
  const raw = import.meta.env?.VITE_GEMINI_OCR_MAX_EDGE;
  if (!raw) return DEFAULT_MAX_EDGE;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 640 ? n : DEFAULT_MAX_EDGE;
}

/**
 * Apply EXIF orientation and downscale for fewer vision tokens.
 * Returns a JPEG File suitable for Gemini OCR.
 */
export async function preprocessImageForOcr(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const maxEdge = ocrMaxEdge();
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
