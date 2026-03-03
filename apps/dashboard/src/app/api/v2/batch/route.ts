/**
 * Batch API Endpoint
 * 
 * Execute multiple API operations in a single request.
 * Reduces latency for clients needing multiple data points.
 * 
 * @route POST /api/v2/batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hybridAuthMiddleware } from '@/lib/x402';
import { logger, createRequestContext, completeRequest } from '@/lib/monitoring';
import { trackRequest } from '@/lib/redis';

const ENDPOINT = '/api/v2/batch';

// =============================================================================
// SCHEMAS
// =============================================================================

const batchRequestSchema = z.object({
  requests: z.array(z.object({
    id: z.string().optional(),
    endpoint: z.enum([
      'coins',
      'coin',
      'global',
      'defi',
      'gas',
      'ticker',
      'search',
      'trending',
      'volatility',
      'historical',
    ]),
    params: z.record(z.unknown()).optional(),
  })).min(1).max(10), // Max 10 operations per batch
});

type BatchRequest = z.infer<typeof batchRequestSchema>;

// =============================================================================
// INTERNAL FETCHERS
// =============================================================================

async function fetchEndpoint(
  endpoint: string,
  params: Record<string, unknown> = {},
  baseUrl: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const url = new URL(`/api/v2/${endpoint}`, baseUrl);
    
    // Add params as query string
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    
    // Internal fetch - no auth needed
    const response = await fetch(url.toString(), {
      headers: {
        'X-Internal-Batch': 'true',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }
    
    return {
      success: true,
      data: data.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  const ctx = createRequestContext(ENDPOINT, 'POST');
  
  // Skip auth for internal batch calls
  const isInternal = request.headers.get('X-Internal-Batch') === 'true';
  
  if (!isInternal) {
    const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
    if (authResponse) {
      completeRequest(ctx, 401);
      return authResponse;
    }
  }
  
  try {
    const body = await request.json();
    const parsed = batchRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid batch request',
          details: parsed.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }
    
    const { requests } = parsed.data;
    const baseUrl = new URL(request.url).origin;
    
    // Execute all requests in parallel
    const results = await Promise.all(
      requests.map(async (req, index) => {
        const id = req.id || `${index}`;
        
        // Map endpoint to path
        let path: string = req.endpoint;
        const params = { ...req.params };
        if (req.endpoint === 'coin' && params?.id) {
          path = `coin/${params.id}`;
          delete params.id;
        } else if (req.endpoint === 'historical' && params?.id) {
          path = `historical/${params.id}`;
          delete params.id;
        }
        
        const result = await fetchEndpoint(path, params, baseUrl);
        
        return {
          id,
          endpoint: req.endpoint,
          ...result,
        };
      })
    );
    
    const successCount = results.filter(r => r.success).length;
    const latencyMs = performance.now() - startTime;
    
    // Track analytics
    trackRequest({
      endpoint: '/api/v2/batch',
      method: 'POST',
      statusCode: 200,
      latencyMs,
    }).catch(() => {});
    
    completeRequest(ctx, 200);
    
    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
        },
      },
      meta: {
        endpoint: '/api/v2/batch',
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        latencyMs: Math.round(latencyMs),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Batch request failed: ${errorMessage}`);
    completeRequest(ctx, 500, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Batch request failed',
        requestId: ctx.requestId,
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
