/** True when the URL is suitable for eBay export (public HTTP/S URL, not a blob). */
export function isPersistentImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:')) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}
