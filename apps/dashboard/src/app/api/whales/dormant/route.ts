/**
 * Smart Money API Proxy — Dormant Wallets
 *
 * Proxies to /api/whales/dormant on the backend.
 */

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 600;

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/whales/dormant`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 600 },
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
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch dormant wallets', message: String(error) },
      { status: 502 },
    );
  }
}
