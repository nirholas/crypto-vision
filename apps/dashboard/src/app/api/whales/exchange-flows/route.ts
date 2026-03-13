/**
 * Smart Money API Proxy — Exchange Flows
 *
 * Proxies to /api/whales/exchange-flows on the backend.
 */

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 300;

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/whales/exchange-flows`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
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
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch exchange flows', message: String(error) },
      { status: 502 },
    );
  }
}
