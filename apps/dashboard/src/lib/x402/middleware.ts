/**
 * x402 Payment Middleware for Next.js
 *
 * This middleware intercepts requests to premium API endpoints
 * and enforces payment requirements using the x402 protocol.
 *
 * Authentication flow:
 * 1. Check for valid API key → Use subscription tier rate limits
 * 2. Check for active access pass → Use pass rate limits
 * 3. Check for x402 payment signature → Verify and allow
 * 4. No auth → Return 402 Payment Required
 */

import { NextRequest, NextResponse } from 'next/server';
import { paymentProxy } from '@x402/next';
import { x402Server } from './server';
import { createRoutes, isPricedRoute, getRoutePrice } from './routes';
import { getTierFromApiKey, checkTierRateLimit, checkRateLimit } from './rate-limit';
import { API_TIERS, API_PRICING } from './pricing';
import { PAYMENT_ADDRESS, CURRENT_NETWORK, USDC_ADDRESSES, getSupportedNetworks } from './config';
import { getActivePass, recordPassRequest, getPassRateLimit, PASS_CONFIG } from './passes';
import { createReceipt } from './payments';

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

/**
 * Get the x402 payment proxy middleware
 * Use this in your middleware.ts file
 */
export function getPaymentMiddleware() {
  // Cast routes to expected type - RouteConfig is compatible with x402 expectations
  return paymentProxy(createRoutes() as unknown as Parameters<typeof paymentProxy>[0], x402Server);
}

// =============================================================================
// HYBRID MIDDLEWARE (API Key + x402)
// =============================================================================

/**
 * Hybrid authentication middleware
 * Supports both API key authentication and x402 payments
 *
 * @example
 * ```ts
 * // In API route
 * import { hybridAuthMiddleware } from '@/lib/x402/middleware';
 *
 * export async function GET(request: NextRequest) {
 *   const authResult = await hybridAuthMiddleware(request, '/api/v1/coins');
 *   if (authResult) return authResult; // Returns 402 or 429 if auth fails
 *
 *   // Proceed with request...
 * }
 * ```
 */
export async function hybridAuthMiddleware(
  request: NextRequest,
  endpoint: string
): Promise<NextResponse | null> {
  // 1. Check for API key (subscription model)
  const apiKey = request.headers.get('X-API-Key') || request.nextUrl.searchParams.get('api_key');

  if (apiKey) {
    const tier = getTierFromApiKey(apiKey);

    if (tier) {
      // Valid API key - check rate limits
      const rateLimit = checkTierRateLimit(apiKey, tier);

      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: 'Rate Limit Exceeded',
            message: `You have exceeded your ${API_TIERS[tier].name} tier limit`,
            tier: tier,
            limit: rateLimit.limit,
            resetAt: new Date(rateLimit.resetAt).toISOString(),
            upgrade: 'https://crypto-data-aggregator.vercel.app/pricing',
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': rateLimit.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimit.resetAt.toString(),
              'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
            },
          }
        );
      }

      // Rate limit OK - allow request
      return null;
    }

    // Invalid API key
    return NextResponse.json(
      {
        error: 'Invalid API Key',
        message: 'The provided API key is invalid or expired',
        docs: 'https://crypto-data-aggregator.vercel.app/docs/api',
      },
      { status: 401 }
    );
  }

  // 2. Check for access pass (wallet-based)
  const walletAddress = request.headers.get('X-Wallet-Address');
  if (walletAddress) {
    const pass = await getActivePass(walletAddress);

    if (pass) {
      // Check pass rate limit (per minute)
      const passRateLimit = getPassRateLimit(pass);
      const rateLimit = checkRateLimit(`pass:${pass.id}`, passRateLimit);

      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: 'Rate Limit Exceeded',
            message: `Pass rate limit: ${passRateLimit} requests/minute`,
            passId: pass.id,
            resetAt: new Date(rateLimit.resetAt).toISOString(),
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': passRateLimit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimit.resetAt.toString(),
              'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
            },
          }
        );
      }

      // Record request against pass
      await recordPassRequest(pass.id);

      // Allow request
      return null;
    }
  }

  // 3. Check for x402 payment signature
  const paymentSignature =
    request.headers.get('X-Payment') || request.headers.get('PAYMENT-SIGNATURE');

  if (paymentSignature) {
    // Payment signature present - let x402 middleware handle verification
    // This will be handled by the paymentProxy middleware
    return null;
  }

  // 4. No authentication - return 402 Payment Required
  const price = getRoutePrice('GET', endpoint);

  if (!price) {
    // Not a priced endpoint - allow through
    return null;
  }

  return create402Response(endpoint, price);
}

// =============================================================================
// 402 RESPONSE GENERATION
// =============================================================================

/**
 * Create a 402 Payment Required response
 * Follows x402 protocol specification with multi-network support
 */
export function create402Response(endpoint: string, price: string): NextResponse {
  const requestId = crypto.randomUUID();
  const priceNum = parseFloat(price.replace('$', ''));
  const priceInUSDC = Math.round(priceNum * 1e6); // USDC has 6 decimals

  // Get all supported networks for payment
  const networks = getSupportedNetworks(process.env.NODE_ENV !== 'production');

  const paymentRequirements = {
    x402Version: 2,
    accepts: networks.map((network) => ({
      scheme: 'exact',
      network: network.id,
      maxAmountRequired: priceInUSDC.toString(),
      resource: endpoint,
      description: `API access: ${endpoint}`,
      mimeType: 'application/json',
      payTo: PAYMENT_ADDRESS,
      paymentNonce: requestId,
      asset: USDC_ADDRESSES[network.id],
      extra: {
        networkName: network.name,
        gasCost: network.gasCost,
        recommended: network.recommended,
      },
    })),
  };

  return NextResponse.json(
    {
      error: 'Payment Required',
      message: `This endpoint requires payment of ${price} USD`,
      price: price,
      priceUSDC: priceInUSDC,
      endpoint: endpoint,
      paymentMethods: [
        {
          type: 'x402',
          description: 'Pay per request with USDC',
          networks: networks.map((n) => ({
            id: n.id,
            name: n.name,
            recommended: n.recommended,
            gasCost: n.gasCost,
          })),
          docs: 'https://docs.x402.org',
        },
        {
          type: 'accessPass',
          description: 'Buy unlimited access for a time period',
          options: Object.values(PASS_CONFIG).map((p) => ({
            duration: p.duration,
            name: p.name,
            price: `$${p.priceUsd.toFixed(2)}`,
            url: `/api/premium/pass/${p.duration}`,
          })),
        },
        {
          type: 'subscription',
          description: 'Subscribe for monthly API access',
          tiers: Object.values(API_TIERS).map((t) => ({
            name: t.name,
            price: t.priceDisplay,
            requests: t.rateLimit,
          })),
          url: 'https://crypto-data-aggregator.vercel.app/pricing',
        },
      ],
      x402: paymentRequirements,
    },
    {
      status: 402,
      headers: {
        'X-Payment-Required': 'true',
        'X-Price-USD': price,
        'X-Network': CURRENT_NETWORK,
        'WWW-Authenticate': `X402 realm="${endpoint}"`,
      },
    }
  );
}

// =============================================================================
// ROUTE MATCHER
// =============================================================================

/**
 * Matcher config for Next.js middleware
 * Only run on premium API routes
 */
export const PROTECTED_ROUTES = Object.keys(API_PRICING).map((p) => p + '/:path*');

export const middlewareConfig = {
  matcher: [
    '/api/v1/coins/:path*',
    '/api/v1/coin/:path*',
    '/api/v1/market-data/:path*',
    '/api/v1/trending/:path*',
    '/api/v1/defi/:path*',
    '/api/v1/export/:path*',
    '/api/v1/historical/:path*',
    '/api/v1/correlation/:path*',
    '/api/v1/screener/:path*',
    '/api/v1/sentiment/:path*',
    '/api/v1/alerts/:path*',
    '/api/v1/webhooks/:path*',
    '/api/v1/portfolio/:path*',
  ],
};
