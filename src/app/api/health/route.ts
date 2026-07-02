import { healthPayload } from '@/server/apiHandlers';

export async function GET() {
  return Response.json(healthPayload());
}
