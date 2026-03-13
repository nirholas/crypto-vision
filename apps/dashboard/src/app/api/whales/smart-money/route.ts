/**
 * Smart Money API Proxy — Smart Money Analysis
 *
 * Proxies to /api/whales/smart-money on the backend.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 120;

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get('limit') || '20';

  try {
    const res = await fetch(`${BACKEND_URL}/api/whales/smart-money?limit=${limit}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 120 },
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
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch smart money data', message: String(error) },
      { status: 502 },
    );
  }
}
