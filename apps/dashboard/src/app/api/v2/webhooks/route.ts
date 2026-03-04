/**
 * Webhooks API Endpoint
 * 
 * Manage webhook subscriptions for price alerts and events.
 * 
 * @route GET/POST/DELETE /api/v2/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hybridAuthMiddleware } from '@/lib/x402';
import { logger, createRequestContext, completeRequest } from '@/lib/monitoring';
import { 
  registerWebhook, 
  getWebhooksByKeyId, 
  deleteWebhook,
  WEBHOOK_EVENTS,
  WebhookSubscription,
} from '@/lib/webhooks';

const ENDPOINT = '/api/v2/webhooks';

// =============================================================================
// SCHEMAS
// =============================================================================

const createWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.enum(WEBHOOK_EVENTS as [string, ...string[]])).min(1, 'At least one event required'),
  secret: z.string().min(16).optional(),
  headers: z.record(z.string()).optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// GET - List webhooks
// =============================================================================

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(ENDPOINT);
  
  // Extract API key from headers for webhook lookup
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) {
    const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
    if (authResponse) {
      completeRequest(ctx, 401);
      return authResponse;
    }
  }
  
  try {
    const webhooks = await getWebhooksByKeyId(apiKey || 'unknown');
    
    completeRequest(ctx, 200);
    
    return NextResponse.json({
      success: true,
      data: {
        webhooks: webhooks.map((wh: WebhookSubscription) => ({
          id: wh.id,
          url: wh.url,
          events: wh.events,
          active: wh.active,
          createdAt: wh.createdAt,
          lastDeliveryAt: wh.lastDeliveryAt,
          deliveryCount: wh.deliveryCount || 0,
        })),
        count: webhooks.length,
      },
      meta: {
        endpoint: ENDPOINT,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to list webhooks: ${errorMessage}`);
    completeRequest(ctx, 500, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve webhooks' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create webhook
// =============================================================================

export async function POST(request: NextRequest) {
  const ctx = createRequestContext(ENDPOINT, 'POST');
  
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) {
    const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
    if (authResponse) {
      completeRequest(ctx, 401);
      return authResponse;
    }
  }
  
  try {
    const body = await request.json();
    const parsed = createWebhookSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: parsed.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }
    
    const webhook = await registerWebhook(
      apiKey || 'unknown',
      parsed.data.url,
      parsed.data.events as import('@/lib/webhooks').WebhookEvent[],
      {
        secret: parsed.data.secret,
        headers: parsed.data.headers,
        active: parsed.data.active,
        metadata: parsed.data.metadata,
      }
    );
    
    completeRequest(ctx, 201);
    
    return NextResponse.json({
      success: true,
      data: {
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          active: webhook.active,
          createdAt: webhook.createdAt,
        },
      },
      meta: {
        endpoint: ENDPOINT,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to create webhook: ${errorMessage}`);
    completeRequest(ctx, 500, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { success: false, error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete webhook
// =============================================================================

export async function DELETE(request: NextRequest) {
  const ctx = createRequestContext(ENDPOINT, 'DELETE');
  
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) {
    const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
    if (authResponse) {
      completeRequest(ctx, 401);
      return authResponse;
    }
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('id');
    
    if (!webhookId) {
      return NextResponse.json(
        { success: false, error: 'Webhook ID required' },
        { status: 400 }
      );
    }
    
    const deleted = await deleteWebhook(webhookId, apiKey || 'unknown');
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Webhook not found' },
        { status: 404 }
      );
    }
    
    completeRequest(ctx, 200);
    
    return NextResponse.json({
      success: true,
      data: { deleted: true, id: webhookId },
      meta: {
        endpoint: ENDPOINT,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to delete webhook: ${errorMessage}`);
    completeRequest(ctx, 500, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { success: false, error: 'Failed to delete webhook' },
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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
