import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

/**
 * CORS middleware configured from allowed origins list
 */
export function corsMiddleware(origins: string[]): MiddlewareHandler {
  if (origins.includes('*')) {
    return cors();
  }

  return cors({ origin: origins });
}
