/**
 * Secure API v2 - Gas Tracker
 * 
 * Returns current gas/fee estimates for major networks
 * Multi-chain support with source obfuscation
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridAuthMiddleware } from '@/lib/x402';
import { getGasPrices, DataSourceError } from '@/lib/data-sources';
import { checkRateLimit, addRateLimitHeaders, rateLimitResponse } from '@/lib/rate-limit';

const ENDPOINT = '/api/v2/gas';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
};

export async function GET(request: NextRequest) {
  // Check rate limit
  const rateLimitResult = checkRateLimit(request);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult);
  }
  
  const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
  if (authResponse) return authResponse;

  const searchParams = request.nextUrl.searchParams;
  const network = searchParams.get('network') || 'all';

  try {
    const gasPrices = await getGasPrices();
    
    let data: any = gasPrices;
    
    // Filter by network if specified
    if (network !== 'all') {
      if (network === 'ethereum' || network === 'eth') {
        data = { ethereum: gasPrices.ethereum };
      } else if (network === 'bitcoin' || network === 'btc') {
        data = { bitcoin: gasPrices.bitcoin };
      }
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          ...data,
          units: {
            ethereum: 'gwei',
            bitcoin: 'sat/vB',
          },
          recommendations: {
            ethereum: getEthRecommendation(gasPrices.ethereum.standard),
            bitcoin: getBtcRecommendation(gasPrices.bitcoin.standard),
          },
        },
        meta: {
          endpoint: ENDPOINT,
          network,
          timestamp: new Date().toISOString(),
          refreshInterval: 15, // seconds
        },
      },
      { headers: SECURITY_HEADERS }
    );
    
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    const message = error instanceof DataSourceError 
      ? error.message 
      : 'Failed to fetch gas prices';

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: 'SERVICE_UNAVAILABLE',
      },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }
}

function getEthRecommendation(gwei: number): string {
  if (gwei < 20) return 'Very low - great time to transact';
  if (gwei < 40) return 'Normal - good for most transactions';
  if (gwei < 80) return 'Elevated - consider waiting if not urgent';
  return 'High - wait for lower fees if possible';
}

function getBtcRecommendation(satVb: number): string {
  if (satVb < 10) return 'Very low - excellent time to transact';
  if (satVb < 30) return 'Normal - suitable for standard transactions';
  if (satVb < 60) return 'Elevated - consider batching transactions';
  return 'High - wait or use Lightning Network';
}
