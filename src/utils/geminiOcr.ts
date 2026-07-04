import { preprocessImageForOcr } from './imagePreprocess';
import { getAccessToken } from '../lib/supabase';
import { fetchWithTimeout } from './fetchWithTimeout';

export class OcrError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_CONFIGURED' | 'API' | 'NETWORK' | 'EMPTY',
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

async function blobToBase64(blob: Blob): Promise<{ base64: string; mimeType: string }> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return {
    base64: btoa(binary),
    mimeType: blob.type || 'image/jpeg',
  };
}

async function callOcrApi(
  mode: 'label' | 'upc',
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  onProgress?.('Straightening photo…');
  const prepared = await preprocessImageForOcr(file);
  const { base64, mimeType } = await blobToBase64(prepared);

  let res: Response;
  try {
    const token = await getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    res = await fetchWithTimeout('/api/ocr', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode, image: base64, mimeType }),
      timeoutMs: 60_000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new OcrError(msg, 'NETWORK');
  }

  const payload = (await res.json().catch(() => ({}))) as { text?: string; error?: string; detail?: string };

  if (res.status === 503) {
    throw new OcrError(
      payload.detail || 'OCR is not configured on the server. Set GEMINI_API_KEY and restart.',
      'NOT_CONFIGURED',
    );
  }

  if (!res.ok) {
    throw new OcrError(payload.detail || payload.error || `OCR failed (HTTP ${res.status})`, 'API');
  }

  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    throw new OcrError('OCR returned no usable text.', 'EMPTY');
  }

  return text;
}

/**
 * Two-pass label OCR via the server (Gemini API key stays server-side).
 * Image is EXIF-corrected and downscaled in the browser before upload.
 */
export async function extractTextFromImage(
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  onProgress?.('Reading label (1/2)…');
  const text = await callOcrApi('label', file, onProgress);
  onProgress?.('Reading label (2/2)…');
  return text;
}

/** Extract UPC/EAN digits from a barcode photo via the server OCR API. */
export async function extractUpcFromImage(
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  return callOcrApi('upc', file, onProgress);
}
