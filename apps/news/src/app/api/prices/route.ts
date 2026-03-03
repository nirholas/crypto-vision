/**
 * Simple price lookup API route
 * GET /api/prices?coins=bitcoin,ethereum,solana
 * Returns { bitcoin: { usd: 50000, usd_24h_change: 1.5 }, ... }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { COINGECKO_BASE } from '@/lib/constants';

export const revalidate = 120;

export async function GET(request: NextRequest) {
  const coins = request.nextUrl.searchParams.get('coins');

  if (!coins) {
    return NextResponse.json(
      { error: 'Missing "coins" query parameter' },
      { status: 400 }
    );
  }

  const coinIds = coins
    .split(',')
    .map(c => c.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20); // Limit to 20 coins max

  if (coinIds.length === 0) {
    return NextResponse.json({});
  }

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 120 } }
    );

    if (!res.ok) {
      return NextResponse.json({});
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch {
    return NextResponse.json({}, { status: 200 }); // Graceful empty on error
  }
}
