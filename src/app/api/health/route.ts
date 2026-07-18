import { publicEnv } from '@/lib/env/public';
import { serverEnv } from '@/lib/env/server';
import { isGeminiConfigured } from '@/lib/ocr/gemini';
import { isEbayConfigured } from '@/lib/marketplaces/ebay/config';
import {
  getEbayDeletionEndpointUrl,
  isEbayDeletionEndpointConfigured,
} from '@/lib/marketplaces/ebay/accountDeletion';
import { isAdminSupabaseConfigured } from '@/lib/supabase/admin';

export async function GET() {
  return Response.json({
    ok: true,
    ebayConfigured: isEbayConfigured(),
    ebayEnv: serverEnv('EBAY_ENV') || 'sandbox',
    ebayDeletionEndpointConfigured: isEbayDeletionEndpointConfigured(),
    ebayDeletionEndpointUrl: getEbayDeletionEndpointUrl(),
    geminiConfigured: isGeminiConfigured(),
    supabaseConfigured: !!(
      publicEnv('SUPABASE_URL') &&
      publicEnv('SUPABASE_ANON_KEY')
    ),
    supabaseAdminConfigured: isAdminSupabaseConfigured(),
    version: '1.0.0',
  });
}
