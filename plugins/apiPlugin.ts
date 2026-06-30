import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { handleApiRequest } from '../server/apiHandlers.js';

function apiMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  handleApiRequest(req, res)
    .then(handled => {
      if (!handled) next();
    })
    .catch(err => {
      console.error('[api]', err);
      next(err);
    });
}

/** Vite dev/preview middleware for product lookup API. */
export function apiPlugin(): Plugin {
  return {
    name: 'mtg-api',
    configureServer(server) {
      server.middlewares.use(apiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiMiddleware);
    },
  };
}
