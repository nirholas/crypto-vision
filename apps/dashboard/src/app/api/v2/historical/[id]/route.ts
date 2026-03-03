/**
 * Secure API v2 - Historical Price Data
 * 
 * Returns historical OHLC and volume data for charting
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridAuthMiddleware } from '@/lib/x402';
import { getHistoricalPrices, DataSourceError } from '@/lib/data-sources';

const ENDPOINT = '/api/v2/historical';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

const VALID_PERIODS = [1, 7, 14, 30, 90, 180, 365];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
  if (authResponse) return authResponse;

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '30');

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

  if (!VALID_PERIODS.includes(days)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid period. Valid options: ${VALID_PERIODS.join(', ')}`,
        code: 'INVALID_REQUEST',
      },
      { status: 400, headers: SECURITY_HEADERS }
    );
  }

  try {
    const data = await getHistoricalPrices(id.toLowerCase(), days);

    // Calculate summary statistics
    const prices = data.map(d => d.price);
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const open = prices[0];
    const close = prices[prices.length - 1];
    const change = ((close - open) / open) * 100;

    return NextResponse.json(
      {
        success: true,
        data: {
          prices: data,
          summary: {
            open,
            close,
            high,
            low,
            change: Math.round(change * 100) / 100,
            dataPoints: data.length,
          },
        },
        meta: {
          endpoint: `${ENDPOINT}/${id}`,
          coinId: id,
          days,
          timestamp: new Date().toISOString(),
        },
      },
      { headers: SECURITY_HEADERS }
    );
  } catch (error) {
    const message = error instanceof DataSourceError 
      ? error.message 
      : 'Historical data not available';

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
