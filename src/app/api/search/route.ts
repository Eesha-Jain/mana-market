import { handleSearchGet } from '@/server/apiHandlers';

export async function GET(request: Request) {
  return handleSearchGet(request);
}
