import { searchItem } from '@/server/search';
import {
  extractTextFromImageBase64,
  extractUpcFromImageBase64,
  isGeminiConfigured,
} from '@/server/ocr';
import { publicEnv } from '@/lib/env';

export function healthPayload() {
  return {
    ok: true,
    ebayConfigured: !!process.env.EBAY_APP_ID,
    geminiConfigured: isGeminiConfigured(),
    supabaseConfigured: !!(
      publicEnv('SUPABASE_URL') &&
      publicEnv('SUPABASE_ANON_KEY')
    ),
    version: '1.0.0',
  };
}

export async function handleSearchGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const upc = url.searchParams.get('upc') ?? undefined;
  const sku = url.searchParams.get('sku') ?? undefined;

  if (!q && !upc && !sku) {
    return Response.json(
      { error: 'Provide at least ?q=, ?upc=, or ?sku=' },
      { status: 400 },
    );
  }

  try {
    const result = await searchItem(q, upc, sku);
    return Response.json(result);
  } catch (err) {
    console.error('[search]', err);
    const message = err instanceof Error ? err.message : 'Search failed';
    return Response.json(
      { error: 'Search failed', detail: message },
      { status: 500 },
    );
  }
}

export async function handleOcrPost(request: Request): Promise<Response> {
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
