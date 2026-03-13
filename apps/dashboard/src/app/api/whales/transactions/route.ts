/**
 * Smart Money API Proxy — Whale Transactions
 *
 * Proxies to the backend Hono API at /api/whales/transactions.
 * Adds CORS headers and caching for the Next.js dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const minUsd = searchParams.get('min_usd') || '100000';
  const limit = searchParams.get('limit') || '50';
  const chain = searchParams.get('chain') || '';
  const type = searchParams.get('type') || '';

  const params = new URLSearchParams({ min_usd: minUsd, limit });
  if (chain) params.set('chain', chain);
  if (type) params.set('type', type);

  try {
    const res = await fetch(`${BACKEND_URL}/api/whales/transactions?${params}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend error: ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch whale transactions', message: String(error) },
      { status: 502 },
    );
  }
}
