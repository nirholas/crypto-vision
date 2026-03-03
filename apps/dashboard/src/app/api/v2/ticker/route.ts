/**
 * Secure API v2 - Ticker/Price Data
 * 
 * Real-time price data with bid/ask spreads
 * Exchange data aggregated with no source attribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridAuthMiddleware } from '@/lib/x402';
import { getExchangeTicker, DataSourceError } from '@/lib/data-sources';
import { checkRateLimit, addRateLimitHeaders, rateLimitResponse } from '@/lib/rate-limit';

const ENDPOINT = '/api/v2/ticker';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
};

// Supported symbols
const SUPPORTED_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC',
  'LINK', 'UNI', 'ATOM', 'LTC', 'ETC', 'XLM', 'ALGO', 'VET', 'FIL', 'AAVE',
];

export async function GET(request: NextRequest) {
  // Check rate limit
  const rateLimitResult = checkRateLimit(request);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult);
  }
  
  const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
  if (authResponse) return authResponse;

  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const symbols = searchParams.get('symbols')?.toUpperCase().split(',').filter(Boolean);

  // Validate input
  if (!symbol && !symbols?.length) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required parameter: symbol or symbols',
        code: 'INVALID_REQUEST',
        supported: SUPPORTED_SYMBOLS,
      },
      { status: 400, headers: SECURITY_HEADERS }
    );
  }

  try {
    const symbolsToFetch = symbols || [symbol!];
    
    // Validate symbols
    const invalid = symbolsToFetch.filter(s => !SUPPORTED_SYMBOLS.includes(s));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported symbol(s): ${invalid.join(', ')}`,
          code: 'INVALID_SYMBOL',
          supported: SUPPORTED_SYMBOLS,
        },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Fetch ticker data for all symbols
    const results = await Promise.all(
      symbolsToFetch.map(async (sym) => {
        try {
          return await getExchangeTicker(sym);
        } catch {
          return { symbol: sym, error: true };
        }
      })
    );

    const successful = results.filter(r => !('error' in r));
    const failed = results.filter(r => 'error' in r).map(r => r.symbol);

    const response = NextResponse.json(
      {
        success: true,
        data: symbolsToFetch.length === 1 ? successful[0] : successful,
        meta: {
          endpoint: ENDPOINT,
          symbols: symbolsToFetch,
          successful: successful.length,
          failed: failed.length > 0 ? failed : undefined,
          timestamp: new Date().toISOString(),
        },
      },
      { headers: SECURITY_HEADERS }
    );
    
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    const message = error instanceof DataSourceError 
      ? error.message 
      : 'Failed to fetch ticker data';

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
