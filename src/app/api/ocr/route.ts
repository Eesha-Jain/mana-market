import { requireApiAuth } from '@/lib/auth/server';
import {
  extractTextFromImageBase64,
  extractUpcFromImageBase64,
  isGeminiConfigured,
} from '@/lib/ocr/gemini';

export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (auth instanceof Response) return auth;

  if (!isGeminiConfigured()) {
    return Response.json(
      {
        error: 'OCR not configured',
        detail: 'Set GEMINI_API_KEY on the server.',
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      mode?: string;
      image?: string;
      mimeType?: string;
    };

    const mode = body.mode === 'upc' ? 'upc' : 'label';
    const image = typeof body.image === 'string' ? body.image.trim() : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';

    if (!image) {
      return Response.json({ error: 'Missing image (base64)' }, { status: 400 });
    }

    const text = mode === 'upc'
      ? await extractUpcFromImageBase64(image, mimeType)
      : await extractTextFromImageBase64(image, mimeType);

    return Response.json({ text, mode });
  } catch (err) {
    console.error('[ocr]', err);
    const message = err instanceof Error ? err.message : 'OCR failed';
    return Response.json(
      { error: 'OCR failed', detail: message },
      { status: 500 },
    );
  }
}
