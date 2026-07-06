import { publicEnv } from '@/lib/env/public';
import { serverEnv } from '@/lib/env/server';
import { isGeminiConfigured } from '@/lib/ocr/gemini';

export async function GET() {
  return Response.json({
    ok: true,
    ebayConfigured: !!serverEnv('EBAY_APP_ID'),
    geminiConfigured: isGeminiConfigured(),
    supabaseConfigured: !!(
      publicEnv('SUPABASE_URL') &&
      publicEnv('SUPABASE_ANON_KEY')
    ),
    version: '1.0.0',
  });
}
