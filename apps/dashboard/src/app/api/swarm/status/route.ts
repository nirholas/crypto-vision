import { NextRequest, NextResponse } from 'next/server';
import { swarmEventManager } from '../events/route';

/**
 * Get current swarm status
 * GET /api/swarm/status
 */
export async function GET(request: NextRequest) {
  const status = swarmEventManager.getStatus();

  return NextResponse.json(status, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
