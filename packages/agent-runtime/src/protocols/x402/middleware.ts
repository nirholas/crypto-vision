/**
 * x402 Payment Verification Middleware
 *
 * HTTP middleware that enforces x402 payments on configured routes.
 */

import type { Context, Next } from 'hono';
import type {
  X402PricingConfig,
  X402PaymentHeader,
  X402PaymentRequired,
  PaymentVerification,
} from './types.js';
import { verifyPaymentHeader } from '../../utils/crypto.js';

export interface X402MiddlewareConfig {
  /** Route pricing configurations */
  routes: X402PricingConfig[];
  /** Payee wallet address */
  payeeAddress: string;
  /** Chain ID for payment verification */
  chainId: number;
  /** Optional: facilitator URL for delegated verification */
  facilitatorUrl?: string;
  /** Optional: skip verification in development mode */
  devMode?: boolean;
}

/**
 * Create x402 payment enforcement middleware for Hono.
 */
export function createX402Middleware(config: X402MiddlewareConfig) {
  const routeMap = new Map<string, X402PricingConfig>();
  for (const route of config.routes) {
    routeMap.set(normalizeRoute(route.route), route);
  }

  return async (c: Context, next: Next) => {
    const path = normalizeRoute(c.req.path);

    // Find matching price config
    const pricing = findMatchingRoute(path, routeMap);
    if (!pricing) {
      // No pricing configured for this route — pass through
      return next();
    }

    // Dev mode bypass
    if (config.devMode) {
      c.set('x402Payment', { verified: true, devMode: true });
      return next();
    }

    // Check for X-PAYMENT header
    const paymentHeader = c.req.header('X-PAYMENT');
    if (!paymentHeader) {
      // Return 402 Payment Required
      const requirement = buildPaymentRequired(pricing, config);
      return c.json(requirement, 402);
    }

    // Verify payment
    try {
      const payment = JSON.parse(
        Buffer.from(paymentHeader, 'base64').toString()
      ) as X402PaymentHeader;

      const verification = verifyPayment(payment, pricing, config);
      if (!verification.valid) {
        return c.json(
          { error: 'Payment verification failed', details: verification.error },
          402
        );
      }

      // Attach payment info to context
      c.set('x402Payment', verification);
      return next();
    } catch (error) {
      return c.json(
        {
          error: 'Invalid payment header',
          details: error instanceof Error ? error.message : 'Parse error',
        },
        402
      );
    }
  };
}

/**
 * Verify an x402 payment header against pricing config.
 */
function verifyPayment(
  payment: X402PaymentHeader,
  pricing: X402PricingConfig,
  config: X402MiddlewareConfig
): PaymentVerification {
  // Check version
  if (payment.version !== '1') {
    return { valid: false, payer: '', amount: '', token: '', chainId: 0, error: 'Unsupported version' };
  }

  // Check payee matches
  if (payment.payee.toLowerCase() !== config.payeeAddress.toLowerCase()) {
    return { valid: false, payer: payment.payer, amount: payment.amount, token: payment.token, chainId: payment.chainId, error: 'Payee mismatch' };
  }

  // Check chain ID
  if (payment.chainId !== config.chainId) {
    return { valid: false, payer: payment.payer, amount: payment.amount, token: payment.token, chainId: payment.chainId, error: 'Chain ID mismatch' };
  }

  // Check expiry
  if (payment.expiry < Date.now() / 1000) {
    return { valid: false, payer: payment.payer, amount: payment.amount, token: payment.token, chainId: payment.chainId, error: 'Payment expired' };
  }

  // Check amount (convert to smallest unit for comparison)
  const decimals = pricing.decimals ?? 6;
  const requiredAmount = BigInt(
    Math.floor(parseFloat(pricing.price) * 10 ** decimals)
  );
  const paidAmount = BigInt(payment.amount);

  if (paidAmount < requiredAmount) {
    return {
      valid: false,
      payer: payment.payer,
      amount: payment.amount,
      token: payment.token,
      chainId: payment.chainId,
      error: `Insufficient payment: required ${requiredAmount}, got ${paidAmount}`,
    };
  }

  // Verify signature
  try {
    const recovered = verifyPaymentHeader(
      {
        payer: payment.payer,
        payee: payment.payee,
        amount: payment.amount,
        token: payment.token,
        chainId: payment.chainId,
        nonce: payment.nonce,
        expiry: payment.expiry,
      },
      payment.signature
    );

    if (recovered.toLowerCase() !== payment.payer.toLowerCase()) {
      return {
        valid: false,
        payer: payment.payer,
        amount: payment.amount,
        token: payment.token,
        chainId: payment.chainId,
        error: 'Signature verification failed',
      };
    }
  } catch {
    return {
      valid: false,
      payer: payment.payer,
      amount: payment.amount,
      token: payment.token,
      chainId: payment.chainId,
      error: 'Signature verification error',
    };
  }

  return {
    valid: true,
    payer: payment.payer,
    amount: payment.amount,
    token: payment.token,
    chainId: payment.chainId,
    txHash: payment.txHash,
  };
}

/**
 * Build a 402 Payment Required response body.
 */
function buildPaymentRequired(
  pricing: X402PricingConfig,
  config: X402MiddlewareConfig
): X402PaymentRequired {
  const decimals = pricing.decimals ?? 6;
  const amount = BigInt(
    Math.floor(parseFloat(pricing.price) * 10 ** decimals)
  ).toString();

  return {
    version: '1',
    accepts: [
      {
        network: 'evm',
        chainId: config.chainId,
        token: pricing.tokenAddress ?? pricing.token,
        symbol: pricing.token,
        amount,
        payee: config.payeeAddress,
        scheme: 'exact',
      },
    ],
    description: pricing.description ?? `Payment required: ${pricing.price} ${pricing.token}`,
  };
}

/**
 * Normalize a route path for matching.
 */
function normalizeRoute(route: string): string {
  return route.replace(/^\/+|\/+$/g, '').toLowerCase();
}

/**
 * Find a matching route in the pricing map.
 */
function findMatchingRoute(
  path: string,
  routeMap: Map<string, X402PricingConfig>
): X402PricingConfig | null {
  // Exact match
  if (routeMap.has(path)) return routeMap.get(path)!;

  // Check if path starts with any route
  for (const [route, config] of routeMap) {
    if (path.startsWith(route) || path.includes(route)) {
      return config;
    }
  }

  return null;
}
