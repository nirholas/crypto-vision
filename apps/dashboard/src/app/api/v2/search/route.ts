/**
 * Secure API v2 - Search
 * 
 * Search for cryptocurrencies, exchanges, and NFTs
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridAuthMiddleware } from '@/lib/x402';
import { searchCoins, DataSourceError } from '@/lib/data-sources';
import { validateQuery, searchQuerySchema, validationErrorResponse } from '@/lib/api-schemas';
import { createRequestContext, completeRequest } from '@/lib/monitoring';
import { checkRateLimit, addRateLimitHeaders, rateLimitResponse } from '@/lib/rate-limit';

const ENDPOINT = '/api/v2/search';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(ENDPOINT);
  
  // Check rate limit
  const rateLimitResult = checkRateLimit(request);
  if (!rateLimitResult.allowed) {
    completeRequest(ctx, 429);
    return rateLimitResponse(rateLimitResult);
  }
  
  const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
  if (authResponse) {
    completeRequest(ctx, 401);
    return authResponse;
  }

  const validation = validateQuery(request, searchQuerySchema);
  if (!validation.success) {
    completeRequest(ctx, 400, validation.error);
    return validationErrorResponse(validation.error, validation.details);
  }

  const { query } = validation.data;

  try {
    const results = await searchCoins(query);

    // Group by type
    const coins = results.filter(r => r.type === 'coin');
    const exchanges = results.filter(r => r.type === 'exchange');

    completeRequest(ctx, 200);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          coins,
          exchanges,
          total: results.length,
        },
        meta: {
          endpoint: ENDPOINT,
          requestId: ctx.requestId,
          query,
          timestamp: new Date().toISOString(),
        },
      },
      { headers: SECURITY_HEADERS }
    );
    
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    const message = error instanceof DataSourceError 
      ? error.message 
      : 'Search unavailable';

    completeRequest(ctx, 503, error instanceof Error ? error : message);

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: 'SERVICE_UNAVAILABLE',
        requestId: ctx.requestId,
      },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }
}
