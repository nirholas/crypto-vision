/**
 * Secure API v2 - Documentation & Index
 * 
 * Public endpoint showing available API endpoints
 * No source information exposed
 */

import { NextResponse } from 'next/server';
import {
  API_TIERS,
  FACILITATOR_URL,
  PAYMENT_ADDRESS,
  NETWORKS,
} from '@/lib/x402';

const CURRENT_NETWORK =
  process.env.X402_NETWORK ||
  (process.env.NODE_ENV === 'production' ? NETWORKS.BASE_MAINNET : NETWORKS.BASE_SEPOLIA);

export const dynamic = 'force-static';
export const revalidate = 3600;

// V2 API Pricing (per request in USD)
const V2_PRICING = {
  '/api/v2/coins': 0.001,
  '/api/v2/coin/:id': 0.002,
  '/api/v2/global': 0.001,
  '/api/v2/defi': 0.002,
  '/api/v2/gas': 0.0005,
  '/api/v2/ticker': 0.001,
  '/api/v2/historical/:id': 0.003,
  '/api/v2/search': 0.001,
  '/api/v2/trending': 0.001,
  '/api/v2/volatility': 0.002,
};

export async function GET() {
  return NextResponse.json(
    {
      name: 'Crypto Data Aggregator API',
      version: '2.0.0',
      description: 'Comprehensive cryptocurrency and DeFi data API with enhanced security',
      
      // What's new in v2
      changelog: {
        version: '2.0.0',
        highlights: [
          'Enhanced data accuracy through multi-source aggregation',
          'Improved response times with intelligent caching',
          'Unified response format across all endpoints',
          'Better error handling with standardized codes',
          'New endpoints: volatility, gas tracker, ticker',
        ],
      },
      
      // Documentation
      docs: {
        api: 'https://crypto-data-aggregator.vercel.app/docs/api',
        swagger: 'https://crypto-data-aggregator.vercel.app/docs/swagger',
        openapi: 'https://crypto-data-aggregator.vercel.app/api/v2/openapi.json',
        quickstart: 'https://crypto-data-aggregator.vercel.app/docs/getting-started',
        examples: 'https://crypto-data-aggregator.vercel.app/examples',
      },

      // Payment configuration
      x402: {
        version: 2,
        network: CURRENT_NETWORK,
        facilitator: FACILITATOR_URL,
        payTo: PAYMENT_ADDRESS,
        token: 'USDC',
        docs: 'https://docs.x402.org',
      },

      // Authentication methods
      authentication: {
        methods: [
          {
            type: 'x402',
            description: 'Pay per request with USDC on Base',
            header: 'PAYMENT-SIGNATURE',
            recommended: true,
          },
          {
            type: 'apiKey',
            description: 'Monthly subscription with quota',
            header: 'X-API-Key',
            queryParam: 'api_key',
          },
        ],
      },

      // Subscription tiers
      tiers: Object.entries(API_TIERS).map(([id, tier]) => ({
        id,
        name: tier.name,
        price: tier.price === 0 ? 'Free' : `$${tier.price}/month`,
        requestsPerDay: tier.requestsPerDay === -1 ? 'Unlimited' : tier.requestsPerDay.toLocaleString(),
        features: tier.features,
      })),

      // Available endpoints
      endpoints: [
        {
          path: '/api/v2/coins',
          method: 'GET',
          description: 'List cryptocurrencies with market data',
          price: '$0.001',
          params: ['page', 'per_page', 'order', 'ids', 'sparkline'],
          rateLimit: '100/min',
        },
        {
          path: '/api/v2/coin/:id',
          method: 'GET',
          description: 'Detailed data for a specific cryptocurrency',
          price: '$0.002',
          params: ['id'],
          rateLimit: '100/min',
        },
        {
          path: '/api/v2/global',
          method: 'GET',
          description: 'Global market statistics and sentiment',
          price: '$0.001',
          params: [],
          rateLimit: '60/min',
        },
        {
          path: '/api/v2/defi',
          method: 'GET',
          description: 'DeFi protocol TVL and statistics',
          price: '$0.002',
          params: ['limit', 'category'],
          rateLimit: '60/min',
        },
        {
          path: '/api/v2/gas',
          method: 'GET',
          description: 'Gas/fee estimates for Ethereum and Bitcoin',
          price: '$0.0005',
          params: ['network'],
          rateLimit: '120/min',
        },
        {
          path: '/api/v2/ticker',
          method: 'GET',
          description: 'Real-time price ticker with bid/ask',
          price: '$0.001',
          params: ['symbol', 'symbols'],
          rateLimit: '200/min',
        },
        {
          path: '/api/v2/trending',
          method: 'GET',
          description: 'Trending cryptocurrencies',
          price: '$0.001',
          params: [],
          rateLimit: '60/min',
        },
        {
          path: '/api/v2/search',
          method: 'GET',
          description: 'Search for cryptocurrencies',
          price: '$0.001',
          params: ['q'],
          rateLimit: '60/min',
        },
        {
          path: '/api/v2/volatility',
          method: 'GET',
          description: 'Volatility and risk metrics',
          price: '$0.002',
          params: ['ids', 'period'],
          rateLimit: '60/min',
        },
        {
          path: '/api/v2/health',
          method: 'GET',
          description: 'API health status (free)',
          price: 'Free',
          params: [],
          rateLimit: 'Unlimited',
        },
      ],

      // Rate limiting info
      rateLimit: {
        headers: {
          limit: 'X-RateLimit-Limit',
          remaining: 'X-RateLimit-Remaining',
          reset: 'X-RateLimit-Reset',
        },
        tiers: {
          free: '100 requests/day',
          pro: '10,000 requests/day',
          enterprise: 'Unlimited',
          x402: 'Pay per request (no daily limit)',
        },
      },

      // Response format
      responseFormat: {
        success: {
          success: true,
          data: '...',
          meta: {
            endpoint: '/api/v2/...',
            timestamp: 'ISO 8601',
          },
        },
        error: {
          success: false,
          error: 'Human readable message',
          code: 'ERROR_CODE',
        },
      },

      // Error codes
      errorCodes: {
        INVALID_REQUEST: 'Missing or invalid parameters',
        UNAUTHORIZED: 'Invalid or missing authentication',
        RATE_LIMITED: 'Rate limit exceeded',
        PAYMENT_REQUIRED: 'x402 payment required',
        NOT_FOUND: 'Resource not found',
        SERVICE_UNAVAILABLE: 'Temporary service issue',
        INTERNAL_ERROR: 'Unexpected server error',
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
