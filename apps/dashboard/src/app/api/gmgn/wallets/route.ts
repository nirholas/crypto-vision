import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams(searchParams);

  const res = await fetch(`${BACKEND_URL}/api/gmgn/wallets?${params}`, {
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch GMGN wallets' },
      { status: res.status },
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
