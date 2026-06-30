import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest, sendJson } from '../server/apiHandlers.js';

type VercelRequest = IncomingMessage & {
  query: Record<string, string | string[] | undefined>;
};

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  // Vercel non-Next catch-all files do not populate req.query.slug; use req.url.
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

  const handled = await handleApiRequest(req, res, pathname);
  if (!handled) {
    sendJson(res, 404, { error: 'Not found' });
  }
}
