/**
 * OHLC API Route - Multi-timeframe OHLC data for charts
 * GET /api/ohlc?coinId=bitcoin&days=30
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getOHLC } from '@/lib/market-data';

const VALID_DAYS = [1, 7, 14, 30, 90, 180, 365];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const coinId = searchParams.get('coinId');
  const daysParam = searchParams.get('days');

  if (!coinId) {
    return NextResponse.json({ error: 'coinId is required' }, { status: 400 });
  }

  const days = daysParam ? parseInt(daysParam, 10) : 30;
  if (!VALID_DAYS.includes(days)) {
    return NextResponse.json(
      { error: `Invalid days. Must be one of: ${VALID_DAYS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const data = await getOHLC(coinId, days);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch OHLC data' }, { status: 500 });
  }
}
