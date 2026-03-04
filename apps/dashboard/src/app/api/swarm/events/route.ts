import { NextRequest, NextResponse } from 'next/server';

/**
 * Global swarm event manager (singleton)
 */
class SwarmEventManager {
  private clients: Set<ReadableStreamDefaultController<Uint8Array>> = new Set();
  private lastStatus = {
    isRunning: false,
    metrics: null as any,
    lastNarration: null as string | null,
    lastEvent: null as any,
  };

  subscribe(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.clients.add(controller);
    return () => {
      this.clients.delete(controller);
    };
  }

  broadcastNarration(text: string, metrics?: any) {
    this.lastStatus.lastNarration = text;
    if (metrics) this.lastStatus.metrics = metrics;

    const message = `data: ${JSON.stringify({ text, metrics })}\n\n`;
    this.broadcast('narration', message);
  }

  broadcastMetrics(metrics: any) {
    this.lastStatus.metrics = metrics;
    const message = `data: ${JSON.stringify(metrics)}\n\n`;
    this.broadcast('metrics', message);
  }

  broadcastEvent(type: string, narration: string, metrics?: any) {
    this.lastStatus.lastEvent = { type, narration, metrics };
    const message = `data: ${JSON.stringify({ type, narration, metrics })}\n\n`;
    this.broadcast('event', message);
  }

  broadcastStatus(isRunning: boolean) {
    this.lastStatus.isRunning = isRunning;
    const message = `data: ${JSON.stringify({ isRunning })}\n\n`;
    this.broadcast('status', message);
  }

  private broadcast(eventType: string, message: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`event: ${eventType}\n${message}`);

    for (const client of this.clients) {
      try {
        client.enqueue(data);
      } catch (error) {
        this.clients.delete(client);
      }
    }
  }

  getStatus() {
    return this.lastStatus;
  }
}

// Global singleton instance
export const swarmEventManager = new SwarmEventManager();

/**
 * Server-Sent Events endpoint for real-time swarm updates
 * GET /api/swarm/events
 */
export async function GET(request: NextRequest) {
  // Check for SSE support
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

  const stream = new ReadableStream({
    start(controller) {
      // Register this client
      const unsubscribe = swarmEventManager.subscribe(controller);

      // Send initial status
      const status = swarmEventManager.getStatus();
      const encoder = new TextEncoder();

      try {
        // Send connected message
        const connectMsg = encoder.encode(':connected\n\n');
        controller.enqueue(connectMsg);

        // Send current status
        if (status.metrics) {
          const metricsMsg = encoder.encode(
            `event: metrics\ndata: ${JSON.stringify(status.metrics)}\n\n`
          );
          controller.enqueue(metricsMsg);
        }

        if (status.lastNarration) {
          const narrationMsg = encoder.encode(
            `event: narration\ndata: ${JSON.stringify({ text: status.lastNarration })}\n\n`
          );
          controller.enqueue(narrationMsg);
        }
      } catch (error) {
        console.error('Error sending initial data:', error);
      }

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      // Client disconnected
    },
  });

  return new Response(stream, { headers });
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
