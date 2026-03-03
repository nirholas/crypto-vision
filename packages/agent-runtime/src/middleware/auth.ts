/**
 * Agent Authentication Middleware
 *
 * Verifies agent identity using on-chain ERC-8004 registration.
 */

import type { Context, Next } from 'hono';
import { ethers } from 'ethers';
import { verifyMessage } from '../utils/crypto.js';
import { RegistryReader } from '../protocols/erc8004/registry.js';

export interface AuthConfig {
  /** Chain to verify agent identity on */
  chain: string;
  /** Routes that require authentication (empty = all routes) */
  protectedRoutes?: string[];
  /** Routes to skip authentication */
  publicRoutes?: string[];
}

/**
 * Create authentication middleware that verifies on-chain agent identity.
 */
export function createAuthMiddleware(config: AuthConfig) {
  const publicRoutes = new Set(
    (config.publicRoutes ?? [
      '.well-known/agent.json',
      '.well-known/agent-card.json',
      'health',
    ]).map((r) => r.replace(/^\/+/, ''))
  );

  return async (c: Context, next: Next) => {
    const path = c.req.path.replace(/^\/+/, '');

    // Skip auth for public routes
    if (publicRoutes.has(path)) {
      return next();
    }

    // Check for protected routes filter
    if (config.protectedRoutes && config.protectedRoutes.length > 0) {
      const isProtected = config.protectedRoutes.some((route) =>
        path.startsWith(route.replace(/^\/+/, ''))
      );
      if (!isProtected) return next();
    }

    // Check Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    // Support Bearer token and ERC-8004 signature auth
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Bearer tokens are signed messages: base64(JSON.stringify({ address, agentId, timestamp, signature }))
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        const { address, agentId, timestamp, signature } = decoded;

        // Check timestamp (5 minute window)
        if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
          return c.json({ error: 'Token expired' }, 401);
        }

        // Verify signature
        const message = `ERC-8004 Auth: ${address}:${agentId}:${timestamp}`;
        const recovered = verifyMessage(message, signature);

        if (recovered.toLowerCase() !== address.toLowerCase()) {
          return c.json({ error: 'Invalid signature' }, 401);
        }

        // Verify on-chain registration
        const registry = new RegistryReader(config.chain);
        const agent = await registry.getAgent(agentId);

        if (!agent || agent.owner.toLowerCase() !== address.toLowerCase()) {
          return c.json({ error: 'Agent not registered or owner mismatch' }, 401);
        }

        c.set('authenticatedAgent', { address, agentId, agent });
        return next();
      } catch {
        return c.json({ error: 'Invalid authentication token' }, 401);
      }
    }

    return c.json({ error: 'Unsupported authentication scheme' }, 401);
  };
}
