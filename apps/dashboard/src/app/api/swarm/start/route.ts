import { NextRequest, NextResponse } from 'next/server';
import { swarmEventManager } from '../events/route';

/**
 * POST /api/swarm/start
 * Start a new presentation mode session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.openRouterApiKey) {
      return NextResponse.json(
        { error: 'openRouterApiKey is required' },
        { status: 400 }
      );
    }

    // Broadcast that swarm is starting
    swarmEventManager.broadcastStatus(true);
    swarmEventManager.broadcastEvent(
      'init',
      'Initializing autonomous AI agent swarm for live demonstration...'
    );

    // Schedule the start event asynchronously
    // This allows the endpoint to return immediately while the swarm runs in the background
    const startDate = new Date();

    // In a production system, you'd queue this task or run it in a worker
    // For now, we'll just acknowledge receipt
    // The actual presentation would be started by the client-side code

    return NextResponse.json(
      {
        success: true,
        message: 'Swarm session starting...',
        startedAt: startDate.toISOString(),
        eventStreamUrl: '/api/swarm/events',
        statusUrl: '/api/swarm/status',
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('Error starting swarm:', error);
    swarmEventManager.broadcastEvent(
      'error',
      error instanceof Error ? error.message : 'Failed to start swarm'
    );

    return NextResponse.json(
      { error: 'Failed to start swarm session' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/swarm/stop
 * Stop the current presentation mode session
 */
export async function PUT(request: NextRequest) {
  try {
    swarmEventManager.broadcastStatus(false);
    swarmEventManager.broadcastEvent(
      'stopped',
      'Swarm session stopped by user'
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Swarm session stopped',
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error stopping swarm:', error);
    return NextResponse.json(
      { error: 'Failed to stop swarm session' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
