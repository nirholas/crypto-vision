import type { MiddlewareHandler } from 'hono';

import type { PaymentRequirements, VerifyResponse, SettleResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

interface ResourceServerOptions {
  /** URL of the facilitator's /verify endpoint */
  facilitatorUrl: string;
  /** Payment requirements to enforce */
  paymentRequirements: PaymentRequirements;
  /** Optional custom fetch implementation (for testing) */
  fetchFn?: typeof fetch;
}

/**
 * Hono middleware for resource servers.
 * Intercepts requests with an x-402-payment header,
 * verifies and settles via the facilitator, then allows access.
 *
 * If no payment header is present, returns 402 with payment requirements.
 */
export function x402PaymentRequired(options: ResourceServerOptions): MiddlewareHandler {
  const { facilitatorUrl, paymentRequirements, fetchFn = fetch } = options;

  return async (c, next) => {
    const paymentHeader = c.req.header('x-402-payment');

    if (!paymentHeader) {
      return c.json(
        {
          error: 'Payment Required',
          paymentRequirements,
          facilitatorUrl,
        },
        402,
      );
    }

    let payment: unknown;
    try {
      // Support both JSON and base64-encoded payloads (Coinbase SDK compat)
      if (paymentHeader.startsWith('{')) {
        payment = JSON.parse(paymentHeader);
      } else {
        payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));
      }
    } catch {
      return c.json({ error: 'Invalid payment header — expected JSON or base64-encoded JSON' }, 400);
    }

    try {
      // Verify
      const verifyRes = await fetchFn(`${facilitatorUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment, paymentRequirements }),
      });

      const verifyData = (await verifyRes.json()) as VerifyResponse;

      if (!verifyData.isValid) {
        return c.json({ error: 'Payment verification failed', ...verifyData }, 402);
      }

      // Settle
      const settleRes = await fetchFn(`${facilitatorUrl}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment, paymentRequirements }),
      });

      const settleData = (await settleRes.json()) as SettleResponse;

      if (!settleData.success) {
        return c.json({ error: 'Payment settlement failed', ...settleData }, 402);
      }

      // Attach settlement info to the request context for downstream handlers
      c.set('x402Settlement', settleData);
    } catch (err) {
      logger.error({
        error: err instanceof Error ? err.message : 'Unknown',
      }, 'x402 resource server middleware error');
      return c.json({ error: 'Payment processing error' }, 500);
    }

    await next();
  };
}
