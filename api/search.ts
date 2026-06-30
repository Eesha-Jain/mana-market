import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest, sendJson } from '../server/apiHandlers.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const handled = await handleApiRequest(req, res, '/api/search');
  if (!handled) sendJson(res, 404, { error: 'Not found' });
}
