/**
 * @fileoverview X402 Server Middleware
 * @description Framework-agnostic middleware for x402 payment gates
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * @example Express
 * ```typescript
 * import express from 'express';
 * import { x402Paywall } from '@/x402/server/middleware';
 * 
 * const app = express();
 * app.get('/premium', x402Paywall({
 *   price: '0.01',
 *   token: 'USDs',
 *   network: 'arbitrum',
 *   description: 'Premium content access'
 * }), (req, res) => {
 *   res.json({ content: 'Premium data!' });
 * });
 * ```
 * 
 * @example Fastify
 * ```typescript
 * import Fastify from 'fastify';
 * import { x402PaywallFastify } from '@/x402/server/middleware';
 * 
 * const app = Fastify();
 * app.get('/premium', { preHandler: x402PaywallFastify({...}) }, handler);
 * ```
 * 
 * @example Hono
 * ```typescript
 * import { Hono } from 'hono';
 * import { x402PaywallHono } from '@/x402/server/middleware';
 * 
 * const app = new Hono();
 * app.use('/premium/*', x402PaywallHono({...}));
 * ```
 */

import type { Address } from 'viem';
import type { PaymentRequest, X402Chain, X402Token } from '../sdk/types.js';
import type {
  GenericRequest,
  GenericResponse,
  NextFunction,
  MiddlewareHandler,
  PaywallOptions,
  PricingContext,
  PriceCalculator,
} from './types.js';
import { X402PaymentVerifier } from './verifier.js';
import { HTTP402Handler } from '../sdk/http/handler.js';
import { loadX402ServerConfig } from './config.js';
import Logger from '@/utils/logger.js';

// ============================================================================
// Main Paywall Middleware
// ============================================================================

/**
 * Create x402 paywall middleware (Express-compatible)
 * Returns 402 Payment Required if not paid, continues if paid
 * 
 * @param options - Paywall configuration
 * @returns Express-compatible middleware handler
 * 
 * @example
 * ```typescript
 * // Simple fixed price
 * app.get('/joke', x402Paywall({
 *   price: '0.001',
 *   token: 'USDs',
 *   network: 'arbitrum',
 *   description: 'Get a random joke'
 * }), jokeHandler);
 * 
 * // With custom recipient
 * app.get('/premium', x402Paywall({
 *   price: '0.10',
 *   token: 'USDs',
 *   network: 'arbitrum',
 *   recipient: '0x...',
 *   validitySeconds: 600
 * }), premiumHandler);
 * ```
 */
export function x402Paywall(options: PaywallOptions): MiddlewareHandler {
  const config = loadX402ServerConfig();
  const verifier = new X402PaymentVerifier({
    chain: options.network,
    rpcUrl: config.rpcUrls?.[options.network],
  });

  const {
    price,
    token = 'USDs',
    network,
    description,
    recipient = config.walletAddress,
    resource,
    validitySeconds = 300,
    customVerifier,
  } = options;

  if (!recipient) {
    throw new Error('x402Paywall: recipient address is required. Set X402_SERVER_WALLET or provide recipient option.');
  }

  return async function paywallMiddleware(
    req: GenericRequest,
    res: GenericResponse,
    next: NextFunction
  ): Promise<void> {
    // Extract payment proof from headers
    const paymentProof = getHeader(req, 'x-payment-proof');
    const paymentToken = getHeader(req, 'x-payment-token');
    const paymentChain = getHeader(req, 'x-payment-chain');

    // Build payment request for verification
    const paymentRequest: PaymentRequest = {
      amount: price,
      token: (paymentToken as X402Token) || token,
      chain: (paymentChain as X402Chain) || network,
      recipient: recipient as Address,
      resource: resource || getRequestPath(req),
      description,
      deadline: Math.floor(Date.now() / 1000) + validitySeconds,
    };

    // If payment proof provided, verify it
    if (paymentProof) {
      try {
        let isValid = false;

        if (customVerifier) {
          isValid = await customVerifier(paymentProof, paymentRequest);
        } else {
          const result = await verifier.verify({
            proof: paymentProof,
            expected: paymentRequest,
            allowReplay: false,
          });
          isValid = result.valid;
        }

        if (isValid) {
          // Payment verified, add payment info to request and continue
          (req as GenericRequest & { x402Payment?: object }).x402Payment = {
            proof: paymentProof,
            amount: price,
            token,
            chain: network,
            verified: true,
          };
          
          Logger.debug(`x402: Payment verified for ${getRequestPath(req)}`);
          return next();
        }

        Logger.debug(`x402: Payment verification failed for ${getRequestPath(req)}`);
      } catch (error) {
        Logger.warn(`x402: Payment verification error: ${error instanceof Error ? error.message : error}`);
      }
    }

    // No valid payment - return 402 Payment Required
    const http402Response = HTTP402Handler.createResponse(
      paymentRequest,
      description || `Access to ${paymentRequest.resource} requires payment of ${price} ${token}`
    );

    Logger.debug(`x402: Returning 402 for ${getRequestPath(req)} - ${price} ${token}`);

    // Set response
    setStatus(res, 402);
    setHeaders(res, http402Response.headers);
    sendJson(res, http402Response.body);
  };
}

/**
 * Create dynamic pricing paywall middleware
 * Price is calculated at request time based on context
 * 
 * @param calculator - Price calculator instance
 * @param baseOptions - Base paywall options (price will be overridden)
 * @returns Express-compatible middleware handler
 * 
 * @example
 * ```typescript
 * import { dynamicPrice } from '@/x402/server/pricing';
 * 
 * const calculator = dynamicPrice({
 *   base: '0.01',
 *   perToken: '0.0001',
 *   surge: (ctx) => ctx.metadata?.peak ? 1.5 : 1.0,
 *   token: 'USDs',
 *   network: 'arbitrum'
 * });
 * 
 * app.post('/ai/generate', x402DynamicPaywall(calculator, {
 *   token: 'USDs',
 *   network: 'arbitrum',
 *   description: 'AI text generation'
 * }), generateHandler);
 * ```
 */
export function x402DynamicPaywall(
  calculator: PriceCalculator,
  baseOptions: Omit<PaywallOptions, 'price'>
): MiddlewareHandler {
  return async function dynamicPaywallMiddleware(
    req: GenericRequest,
    res: GenericResponse,
    next: NextFunction
  ): Promise<void> {
    // Build pricing context
    const ctx: PricingContext = {
      request: req,
      resource: getRequestPath(req),
      clientIp: getClientIp(req),
      clientAddress: getHeader(req, 'x-payment-address') as Address | undefined,
      metadata: {
        method: req.method,
        query: req.query,
        bodySize: typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body || {}).length,
      },
    };

    // Calculate price
    const priceResult = await calculator.calculate(ctx);

    // Create paywall with calculated price
    const paywall = x402Paywall({
      ...baseOptions,
      price: priceResult.price,
      token: priceResult.token,
      network: priceResult.network,
    });

    // Add price breakdown to response headers
    const originalMiddleware = paywall;
    return originalMiddleware(req, res, next);
  };
}

// ============================================================================
// Framework-Specific Adapters
// ============================================================================

/**
 * Fastify preHandler adapter
 * 
 * @example
 * ```typescript
 * fastify.get('/premium', {
 *   preHandler: x402PaywallFastify({ price: '0.01', token: 'USDs', network: 'arbitrum' })
 * }, handler);
 * ```
 */
export function x402PaywallFastify(options: PaywallOptions) {
  const middleware = x402Paywall(options);

  return async function fastifyPreHandler(
    request: { headers: Record<string, string | string[] | undefined>; url: string; method: string; body?: unknown },
    reply: { code(c: number): unknown; headers(h: Record<string, string>): unknown; send(b: unknown): void }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Adapt Fastify request/reply to generic interface
      const req: GenericRequest = {
        headers: request.headers,
        url: request.url,
        method: request.method,
        body: request.body,
      };

      const res: GenericResponse = {
        status(code: number) {
          reply.code(code);
          return this;
        },
        set(headers: Record<string, string>) {
          reply.headers(headers);
          return this;
        },
        json(body: unknown) {
          reply.send(body);
        },
      };

      const next: NextFunction = (error?: unknown) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      middleware(req, res, next).catch(reject);
    });
  };
}

/**
 * Hono middleware adapter
 * 
 * @example
 * ```typescript
 * app.use('/premium/*', x402PaywallHono({ price: '0.01', token: 'USDs', network: 'arbitrum' }));
 * ```
 */
export function x402PaywallHono(options: PaywallOptions) {
  const middleware = x402Paywall(options);

  return async function honoMiddleware(
    c: {
      req: { header(name: string): string | undefined; path: string; method: string; text(): Promise<string> };
      status(code: number): void;
      header(name: string, value: string): void;
      json(data: unknown): Response;
    },
    next: () => Promise<void>
  ): Promise<Response | void> {
    return new Promise((resolve, reject) => {
      // Adapt Hono context to generic interface
      const headers: Record<string, string | undefined> = {};
      // Common headers to extract
      ['x-payment-proof', 'x-payment-token', 'x-payment-chain', 'x-payment-address'].forEach(h => {
        headers[h] = c.req.header(h);
      });

      const req: GenericRequest = {
        headers,
        path: c.req.path,
        method: c.req.method,
      };

      let responseData: { status: number; headers: Record<string, string>; body: unknown } | null = null;

      const res: GenericResponse = {
        status(code: number) {
          if (!responseData) responseData = { status: code, headers: {}, body: null };
          else responseData.status = code;
          return this;
        },
        set(hdrs: Record<string, string>) {
          if (!responseData) responseData = { status: 200, headers: hdrs, body: null };
          else responseData.headers = { ...responseData.headers, ...hdrs };
          return this;
        },
        json(body: unknown) {
          if (!responseData) responseData = { status: 200, headers: {}, body };
          else responseData.body = body;
        },
      };

      const nextFn: NextFunction = (error?: unknown) => {
        if (error) {
          reject(error);
        } else {
          next().then(() => resolve()).catch(reject);
        }
      };

      middleware(req, res, nextFn)
        .then(() => {
          if (responseData) {
            // Middleware returned 402
            c.status(responseData.status);
            Object.entries(responseData.headers).forEach(([k, v]) => c.header(k, v));
            resolve(c.json(responseData.body));
          }
        })
        .catch(reject);
    });
  };
}

/**
 * Koa middleware adapter
 * 
 * @example
 * ```typescript
 * router.get('/premium', x402PaywallKoa({ price: '0.01', token: 'USDs', network: 'arbitrum' }), handler);
 * ```
 */
export function x402PaywallKoa(options: PaywallOptions) {
  const middleware = x402Paywall(options);

  return async function koaMiddleware(
    ctx: {
      request: { headers: Record<string, string | string[] | undefined>; path: string; method: string; body?: unknown };
      response: { status: number; set(name: string, value: string): void; body: unknown };
    },
    next: () => Promise<void>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const req: GenericRequest = {
        headers: ctx.request.headers,
        path: ctx.request.path,
        method: ctx.request.method,
        body: ctx.request.body,
      };

      const res: GenericResponse = {
        status(code: number) {
          ctx.response.status = code;
          return this;
        },
        set(headers: Record<string, string>) {
          Object.entries(headers).forEach(([k, v]) => ctx.response.set(k, v));
          return this;
        },
        json(body: unknown) {
          ctx.response.body = body;
        },
      };

      const nextFn: NextFunction = (error?: unknown) => {
        if (error) {
          reject(error);
        } else {
          next().then(resolve).catch(reject);
        }
      };

      middleware(req, res, nextFn).catch(reject);
    });
  };
}

// ============================================================================
// Utility Middleware
// ============================================================================

/**
 * Extract payment info middleware
 * Adds x402Payment object to request if payment headers present
 */
export function x402ExtractPayment(): MiddlewareHandler {
  return function extractPaymentMiddleware(
    req: GenericRequest & { x402Payment?: object },
    _res: GenericResponse,
    next: NextFunction
  ): void {
    const proof = getHeader(req, 'x-payment-proof');
    const token = getHeader(req, 'x-payment-token');
    const chain = getHeader(req, 'x-payment-chain');
    const amount = getHeader(req, 'x-payment-amount');

    if (proof) {
      req.x402Payment = {
        proof,
        token,
        chain,
        amount,
        verified: false,
      };
    }

    next();
  };
}

/**
 * Payment analytics middleware
 * Tracks successful payments for analytics
 */
export function x402TrackPayment(
  onPayment: (payment: {
    proof: string;
    amount: string;
    token: string;
    chain: string;
    resource: string;
    timestamp: number;
  }) => void | Promise<void>
): MiddlewareHandler {
  return function trackPaymentMiddleware(
    req: GenericRequest & { x402Payment?: { proof: string; amount: string; token: string; chain: string; verified: boolean } },
    _res: GenericResponse,
    next: NextFunction
  ): void {
    if (req.x402Payment?.verified) {
      const payment = {
        proof: req.x402Payment.proof,
        amount: req.x402Payment.amount,
        token: req.x402Payment.token,
        chain: req.x402Payment.chain,
        resource: getRequestPath(req),
        timestamp: Date.now(),
      };

      // Fire and forget analytics
      Promise.resolve(onPayment(payment)).catch(err => {
        Logger.warn(`x402: Analytics tracking error: ${err}`);
      });
    }

    next();
  };
}

/**
 * Rate limit by payer address
 * Limits requests per payer within a time window
 */
export function x402RateLimit(options: {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Skip rate limit if payment exceeds this amount */
  skipAboveAmount?: string;
}): MiddlewareHandler {
  const { maxRequests, windowSeconds, skipAboveAmount } = options;
  const windowMs = windowSeconds * 1000;
  
  // Simple in-memory store (use Redis in production)
  const requests = new Map<string, { count: number; windowStart: number }>();

  return function rateLimitMiddleware(
    req: GenericRequest & { x402Payment?: { amount: string } },
    res: GenericResponse,
    next: NextFunction
  ): void {
    const payer = getHeader(req, 'x-payment-address');
    if (!payer) {
      return next();
    }

    // Skip rate limit for high-value payments
    if (skipAboveAmount && req.x402Payment) {
      const amount = parseFloat(req.x402Payment.amount);
      const threshold = parseFloat(skipAboveAmount);
      if (amount >= threshold) {
        return next();
      }
    }

    const now = Date.now();
    const record = requests.get(payer);

    if (!record || now - record.windowStart > windowMs) {
      // New window
      requests.set(payer, { count: 1, windowStart: now });
      return next();
    }

    if (record.count >= maxRequests) {
      // Rate limited
      setStatus(res, 429);
      sendJson(res, {
        error: 'Rate limit exceeded',
        message: `Maximum ${maxRequests} requests per ${windowSeconds} seconds`,
        retryAfter: Math.ceil((record.windowStart + windowMs - now) / 1000),
      });
      return;
    }

    record.count++;
    next();
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get header value (case-insensitive)
 */
function getHeader(req: GenericRequest, name: string): string | undefined {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Get request path
 */
function getRequestPath(req: GenericRequest): string {
  return req.path || req.originalUrl || req.url || '/';
}

/**
 * Get client IP address
 */
function getClientIp(req: GenericRequest): string | undefined {
  const forwarded = getHeader(req, 'x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim();
  }
  return getHeader(req, 'x-real-ip');
}

/**
 * Set response status (framework-agnostic)
 */
function setStatus(res: GenericResponse, code: number): void {
  res.status(code);
}

/**
 * Set response headers (framework-agnostic)
 */
function setHeaders(res: GenericResponse, headers: Record<string, string>): void {
  if (res.set) {
    res.set(headers);
  } else if (res.setHeader) {
    Object.entries(headers).forEach(([k, v]) => res.setHeader!(k, v));
  }
}

/**
 * Send JSON response (framework-agnostic)
 */
function sendJson(res: GenericResponse, body: unknown): void {
  res.json(body);
}
