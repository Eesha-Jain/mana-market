import { handleOcrPost } from '@/server/apiHandlers';

export async function POST(request: Request) {
  return handleOcrPost(request);
}
