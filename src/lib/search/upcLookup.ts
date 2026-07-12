import 'server-only';

interface UpcOffer {
  price?: string;
}

interface UpcItem {
  title?: string;
  description?: string;
  brand?: string;
  images?: string[];
  upc?: string;
  offers?: UpcOffer[];
  lowest_recorded_price?: number | null;
  highest_recorded_price?: number | null;
}

export interface UpcData {
  title: string | null;
  description: string;
  brand: string;
  imageUrls: string[];
  upc: string;
  lowestPrice: number | null;
  highestPrice: number | null;
  avgOfferPrice: number | null;
}

export async function lookupUPC(upc: string): Promise<UpcData | null> {
  if (!upc || !/^\d{8,14}$/.test(upc)) return null;
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: UpcItem[] };
    if (!data.items?.length) return null;
    const item = data.items[0]!;

    const prices = (item.offers || [])
      .map(o => parseFloat(o.price ?? ''))
      .filter(p => !isNaN(p) && p > 0);
    const avgOfferPrice = prices.length
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100
      : null;

    return {
      title: item.title || null,
      description: item.description || '',
      brand: item.brand || '',
      imageUrls: item.images || [],
      upc: item.upc || upc,
      lowestPrice: item.lowest_recorded_price ?? null,
      highestPrice: item.highest_recorded_price ?? null,
      avgOfferPrice,
    };
  } catch {
    return null;
  }
}
