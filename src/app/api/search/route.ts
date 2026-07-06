import { requireApiAuth } from '@/lib/auth/server';
import { searchItem } from '@/lib/search/itemSearch';

export async function GET(request: Request) {
  const auth = await requireApiAuth(request);
  if (auth instanceof Response) return auth;

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
