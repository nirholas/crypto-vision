/**
 * Global Market Data API Route
 * GET /api/global
 * 
 * Proxies CoinGecko /global endpoint with server-side caching.
 * Used by the header MarketWidget to avoid direct client→CoinGecko calls.
 */

import { NextResponse } from 'next/server';
import { COINGECKO_BASE } from '@/lib/constants';

export const revalidate = 120; // ISR: revalidate every 2 minutes

export async function GET() {
  try {
    const res = await fetch(`${COINGECKO_BASE}/global`, {
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Upstream error' },
        { status: 502 }
      );
    }

    const json = await res.json();
    return NextResponse.json(json.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch global market data' },
      { status: 500 }
    );
  }
}
