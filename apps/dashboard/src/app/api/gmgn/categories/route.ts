import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export async function GET() {
  const res = await fetch(`${BACKEND_URL}/api/gmgn/categories`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch GMGN categories' },
      { status: res.status },
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
