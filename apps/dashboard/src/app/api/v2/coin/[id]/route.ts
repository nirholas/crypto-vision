/**
 * Secure API v2 - Single Coin Details
 * 
 * Returns detailed cryptocurrency data including
 * description, links, scores, and extended metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridAuthMiddleware } from '@/lib/x402';
import { getCoinDetails, DataSourceError } from '@/lib/data-sources';

const ENDPOINT = '/api/v2/coin';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
  if (authResponse) return authResponse;

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required parameter: id',
        code: 'INVALID_REQUEST',
      },
      { status: 400, headers: SECURITY_HEADERS }
    );
  }

  try {
    const data = await getCoinDetails(id.toLowerCase());

    return NextResponse.json(
      {
        success: true,
        data,
        meta: {
          endpoint: `${ENDPOINT}/${id}`,
          timestamp: new Date().toISOString(),
        },
      },
      { headers: SECURITY_HEADERS }
    );
  } catch (error) {
    const message = error instanceof DataSourceError 
      ? error.message 
      : 'Coin not found or unavailable';

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: 'NOT_FOUND',
      },
      { status: 404, headers: SECURITY_HEADERS }
    );
  }
}
