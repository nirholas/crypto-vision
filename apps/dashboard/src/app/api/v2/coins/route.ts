/**
 * Secure API v2 - Coins Endpoint
 * 
 * Returns cryptocurrency market data with source obfuscation
 * All upstream provider details are hidden from responses
 * 
 * @price $0.001 per request
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridAuthMiddleware } from '@/lib/x402';
import { getCoinMarkets, DataSourceError } from '@/lib/data-sources';
import { validateQuery, coinsQuerySchema, validationErrorResponse } from '@/lib/api-schemas';
import { createRequestContext, completeRequest, metrics } from '@/lib/monitoring';
import { checkRateLimit, addRateLimitHeaders, rateLimitResponse } from '@/lib/rate-limit';

const ENDPOINT = '/api/v2/coins';

// Security headers to prevent information leakage
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(ENDPOINT);
  
  // Check rate limit
  const rateLimitResult = checkRateLimit(request);
  if (!rateLimitResult.allowed) {
    completeRequest(ctx, 429);
    return rateLimitResponse(rateLimitResult);
  }
  
  // Check authentication (API key or x402 payment)
  const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
  if (authResponse) {
    completeRequest(ctx, 401);
    return authResponse;
  }

  // Validate query parameters
  const validation = validateQuery(request, coinsQuerySchema);
  if (!validation.success) {
    completeRequest(ctx, 400, validation.error);
    return validationErrorResponse(validation.error, validation.details);
  }

  const { page, per_page: perPage, order, ids, sparkline } = validation.data;

  try {
    const data = await getCoinMarkets({
      page,
      perPage,
      order,
      ids,
      sparkline,
    });

    completeRequest(ctx, 200);
    
    const response = NextResponse.json(
      {
        success: true,
        data,
        meta: {
          endpoint: ENDPOINT,
          requestId: ctx.requestId,
          page,
          perPage,
          count: data.length,
          hasMore: data.length === perPage,
          timestamp: new Date().toISOString(),
        },
      },
      { headers: SECURITY_HEADERS }
    );
    
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    const message = error instanceof DataSourceError 
      ? error.message 
      : 'An error occurred processing your request';
    
    const code = error instanceof DataSourceError 
      ? error.code 
      : 'INTERNAL_ERROR';

    const statusCode = error instanceof DataSourceError ? 503 : 500;
    completeRequest(ctx, statusCode, error instanceof Error ? error : message);
    metrics.recordError(ENDPOINT, code);

    return NextResponse.json(
      {
        success: false,
        error: message,
        code,
        requestId: ctx.requestId,
      },
      { 
        status: statusCode,
        headers: SECURITY_HEADERS,
      }
    );
  }
}
