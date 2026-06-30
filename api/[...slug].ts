import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest, sendJson } from '../server/apiHandlers.js';

type VercelRequest = IncomingMessage & {
  query: Record<string, string | string[] | undefined>;
};

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  const slug = req.query.slug;
  const parts = Array.isArray(slug) ? slug : slug ? [slug] : [];
  const pathname = `/api/${parts.join('/')}`;

  const handled = await handleApiRequest(req, res, pathname);
  if (!handled) {
    sendJson(res, 404, { error: 'Not found' });
  }
}
