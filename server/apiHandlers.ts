import 'dotenv/config';

import type { IncomingMessage, ServerResponse } from 'node:http';
import { searchItem } from './search';

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function resolvePathname(req: IncomingMessage, pathnameOverride?: string): string {
  if (pathnameOverride) return pathnameOverride;

  const url = new URL(req.url ?? '/', 'http://localhost');
  return url.pathname;
}

/**
 * Handle /api/* routes. Returns true when a route was handled.
 */
export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathnameOverride?: string,
): Promise<boolean> {
  const pathname = resolvePathname(req, pathnameOverride);
  const url = new URL(req.url ?? pathname, 'http://localhost');

  if (pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      ebayConfigured: !!process.env.EBAY_APP_ID,
      supabaseConfigured: !!(
        process.env.VITE_SUPABASE_URL?.trim() &&
        process.env.VITE_SUPABASE_ANON_KEY?.trim()
      ),
      version: '1.0.0',
    });
    return true;
  }

  if (pathname === '/api/search' && req.method === 'GET') {
    const q = url.searchParams.get('q') ?? '';
    const upc = url.searchParams.get('upc') ?? undefined;
    const sku = url.searchParams.get('sku') ?? undefined;
    if (!q && !upc && !sku) {
      sendJson(res, 400, { error: 'Provide at least ?q=, ?upc=, or ?sku=' });
      return true;
    }

    try {
      const result = await searchItem(q, upc, sku);
      sendJson(res, 200, result);
    } catch (err) {
      console.error('[search]', err);
      const message = err instanceof Error ? err.message : 'Search failed';
      sendJson(res, 500, { error: 'Search failed', detail: message });
    }
    return true;
  }

  return false;
}
