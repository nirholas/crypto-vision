/**
 * Secure API v2 - DeFi Data
 * 
 * Returns DeFi protocol TVL and yield data
 * Aggregated from multiple sources with no provider attribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridAuthMiddleware } from '@/lib/x402';
import { getDefiTVL, DataSourceError } from '@/lib/data-sources';
import { checkRateLimit, addRateLimitHeaders, rateLimitResponse } from '@/lib/rate-limit';

const ENDPOINT = '/api/v2/defi';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
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
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const category = searchParams.get('category');

  try {
    const { protocols, totalTVL } = await getDefiTVL();
    
    // Filter by category if specified
    let filtered = protocols;
    if (category) {
      filtered = protocols.filter(p => 
        p.category?.toLowerCase() === category.toLowerCase()
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          protocols: filtered.slice(0, limit),
          summary: {
            totalTVL,
            protocolCount: protocols.length,
            topCategory: getTopCategory(protocols),
          },
        },
        meta: {
          endpoint: ENDPOINT,
          limit,
          category: category || 'all',
          timestamp: new Date().toISOString(),
        },
      },
      { headers: SECURITY_HEADERS }
    );
    
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    const message = error instanceof DataSourceError 
      ? error.message 
      : 'Failed to fetch DeFi data';

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

function getTopCategory(protocols: any[]): string {
  const categories: Record<string, number> = {};
  protocols.forEach(p => {
    if (p.category) {
      categories[p.category] = (categories[p.category] || 0) + p.tvl;
    }
  });
  
  return Object.entries(categories)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Unknown';
}
