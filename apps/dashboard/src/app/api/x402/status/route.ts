/**
 * x402 Payment Status Endpoint
 *
 * GET /api/x402/status
 *
 * Returns the current x402 payment system status including:
 * - Server configuration status
 * - Supported networks and tokens
 * - Facilitator health
 * - Current pricing info
 */

import { NextResponse } from 'next/server';
import { 
  getServerStatus, 
  getRecommendedNetwork,
} from '@/lib/x402/server';
import { 
  PAYMENT_ADDRESS, 
  FACILITATOR_URL,
  getSupportedNetworks,
} from '@/lib/x402/config';
import { getPassOptions } from '@/lib/x402/passes';
import { API_TIERS } from '@/lib/x402/pricing';

export const runtime = 'edge';

export async function GET() {
  const serverStatus = getServerStatus();
  const recommendedNetwork = getRecommendedNetwork();
  const networks = getSupportedNetworks(process.env.NODE_ENV !== 'production');
  const passOptions = getPassOptions();

  // Check facilitator health
  let facilitatorHealth = { status: 'unknown', latencyMs: null as number | null };
  try {
    const start = Date.now();
    const response = await fetch(FACILITATOR_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    facilitatorHealth = {
      status: response.ok ? 'healthy' : 'degraded',
      latencyMs,
    };
  } catch {
    facilitatorHealth = { status: 'unreachable', latencyMs: null };
  }

  return NextResponse.json({
    x402: {
      version: 2,
      protocol: 'https://x402.org',
      docs: 'https://docs.x402.org',
    },

    server: {
      configured: serverStatus.configured,
      status: serverStatus.status,
      paymentAddress: PAYMENT_ADDRESS,
      facilitator: {
        url: FACILITATOR_URL,
        health: facilitatorHealth.status,
        latencyMs: facilitatorHealth.latencyMs,
      },
    },

    networks: {
      recommended: recommendedNetwork ? {
        id: recommendedNetwork.id,
        name: recommendedNetwork.name,
        gasCost: recommendedNetwork.gasCost,
      } : null,
      supported: networks.map((n) => ({
        id: n.id,
        name: n.name,
        testnet: n.testnet,
        recommended: n.recommended,
        gasCost: n.gasCost,
        usdc: n.usdc,
        explorer: n.explorer,
      })),
    },

    paymentOptions: {
      perRequest: {
        description: 'Pay only for what you use',
        minPrice: '$0.001',
        maxPrice: '$0.15',
        howItWorks: [
          '1. Make a request to any premium endpoint',
          '2. Receive 402 response with payment requirements',
          '3. Sign payment with your wallet',
          '4. Include X-Payment header and get data',
        ],
      },
      accessPasses: passOptions.map((p) => ({
        duration: p.duration,
        name: p.name,
        price: `$${p.priceUsd.toFixed(2)}`,
        savings: p.savings,
        rateLimit: `${p.rateLimit}/min`,
        purchaseUrl: `/api/premium/pass/${p.duration}`,
      })),
      subscription: {
        description: 'Monthly subscription with API key',
        tiers: Object.values(API_TIERS).map((t) => ({
          name: t.name,
          price: t.priceDisplay,
          requests: t.rateLimit,
        })),
        signupUrl: '/pricing',
      },
    },

    endpoints: {
      status: '/api/x402/status',
      premium: '/api/premium',
      passes: '/api/premium/pass/{duration}',
      passStatus: '/api/premium/pass/status',
      receipts: '/api/premium/receipts',
    },

    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60',
    },
  });
}
