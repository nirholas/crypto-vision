/**
 * Webhooks API Route
 * CRUD operations for webhook management
 *
 * Endpoints:
 * - GET: List webhooks for authenticated key
 * - POST: Register new webhook
 * - PATCH: Update webhook
 * - DELETE: Remove webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import {
  registerWebhook,
  getWebhooksByKeyId,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  regenerateWebhookSecret,
  getDeliveryLogs,
  getWebhookStats,
  WEBHOOK_EVENTS,
  type WebhookEvent,
} from '@/lib/webhooks';

export const runtime = 'edge';

// ============================================================================
// Helper: Extract and validate API key
// ============================================================================

async function getAuthenticatedKey(request: NextRequest): Promise<{
  keyId: string;
  email: string;
  tier: string;
} | null> {
  const apiKey = request.headers.get('X-API-Key') || request.nextUrl.searchParams.get('api_key');

  if (!apiKey) return null;

  const keyData = await validateApiKey(apiKey);
  if (!keyData) return null;

  return {
    keyId: keyData.id,
    email: keyData.email,
    tier: keyData.tier,
  };
}

// ============================================================================
// GET: List webhooks for authenticated key
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedKey(request);

    if (!auth) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Valid API key required. Include X-API-Key header or api_key query param.',
        },
        { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const webhookId = request.nextUrl.searchParams.get('id');
    const logsParam = request.nextUrl.searchParams.get('logs');
    const statsParam = request.nextUrl.searchParams.get('stats');

    // Get webhook stats
    if (statsParam === 'true') {
      const stats = await getWebhookStats(auth.keyId);
      return NextResponse.json(
        {
          success: true,
          stats,
        },
        {
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Get specific webhook
    if (webhookId) {
      const webhook = await getWebhookById(webhookId);

      if (!webhook || webhook.keyId !== auth.keyId) {
        return NextResponse.json(
          { error: 'Not found', message: 'Webhook not found' },
          { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      // Include delivery logs if requested
      if (logsParam === 'true') {
        const logs = await getDeliveryLogs(webhookId);
        return NextResponse.json(
          {
            success: true,
            webhook: { ...webhook, secret: undefined }, // Don't expose secret
            logs,
          },
          {
            headers: { 'Access-Control-Allow-Origin': '*' },
          }
        );
      }

      return NextResponse.json(
        {
          success: true,
          webhook: { ...webhook, secret: undefined },
        },
        {
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // List all webhooks for the key
    const webhooks = await getWebhooksByKeyId(auth.keyId);

    return NextResponse.json(
      {
        success: true,
        webhooks: webhooks.map((w) => ({ ...w, secret: undefined })),
        count: webhooks.length,
        availableEvents: WEBHOOK_EVENTS,
      },
      {
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('[Webhooks API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to retrieve webhooks' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// ============================================================================
// POST: Register new webhook
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedKey(request);

    if (!auth) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Valid API key required. Include X-API-Key header.',
        },
        { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const body = await request.json();
    const { url, events, metadata } = body;

    // Validate required fields
    if (!url) {
      return NextResponse.json(
        { error: 'Bad request', message: 'URL is required' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        {
          error: 'Bad request',
          message: 'Events array is required',
          availableEvents: WEBHOOK_EVENTS,
        },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Check webhook limit (max 10 per key)
    const existingWebhooks = await getWebhooksByKeyId(auth.keyId);
    if (existingWebhooks.length >= 10) {
      return NextResponse.json(
        {
          error: 'Limit exceeded',
          message: 'Maximum 10 webhooks per API key. Delete an existing webhook first.',
        },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Register the webhook
    const webhook = await registerWebhook(auth.keyId, url, events as WebhookEvent[], metadata);

    return NextResponse.json(
      {
        success: true,
        message: 'Webhook registered successfully',
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret, // Only returned on creation
          active: webhook.active,
          createdAt: webhook.createdAt,
        },
        note: 'Store the secret securely - it will not be shown again. Use it to verify webhook signatures.',
      },
      {
        status: 201,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('[Webhooks API] POST error:', error);

    if (error instanceof Error) {
      if (error.message.includes('Invalid')) {
        return NextResponse.json(
          { error: 'Bad request', message: error.message },
          { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to register webhook' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// ============================================================================
// PATCH: Update webhook
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedKey(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid API key required' },
        { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const body = await request.json();
    const { id, url, events, active, metadata, regenerateSecret: shouldRegenerate } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Webhook ID is required' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Handle secret regeneration
    if (shouldRegenerate) {
      const newSecret = await regenerateWebhookSecret(id, auth.keyId);

      if (!newSecret) {
        return NextResponse.json(
          { error: 'Not found', message: 'Webhook not found or access denied' },
          { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Secret regenerated successfully',
          secret: newSecret,
          note: 'Store the new secret securely - it will not be shown again.',
        },
        {
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Update webhook properties
    const updates: Record<string, unknown> = {};
    if (url !== undefined) updates.url = url;
    if (events !== undefined) updates.events = events;
    if (active !== undefined) updates.active = active;
    if (metadata !== undefined) updates.metadata = metadata;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Bad request', message: 'No updates provided' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const updated = await updateWebhook(id, auth.keyId, updates);

    if (!updated) {
      return NextResponse.json(
        { error: 'Not found', message: 'Webhook not found or access denied' },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Webhook updated successfully',
        webhook: { ...updated, secret: undefined },
      },
      {
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('[Webhooks API] PATCH error:', error);

    if (error instanceof Error && error.message.includes('Invalid')) {
      return NextResponse.json(
        { error: 'Bad request', message: error.message },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to update webhook' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// ============================================================================
// DELETE: Remove webhook
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedKey(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid API key required' },
        { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const webhookId = request.nextUrl.searchParams.get('id');

    if (!webhookId) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Webhook ID is required (use ?id=...)' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const deleted = await deleteWebhook(webhookId, auth.keyId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Not found', message: 'Webhook not found or access denied' },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Webhook deleted successfully',
        id: webhookId,
      },
      {
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error) {
    console.error('[Webhooks API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to delete webhook' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// ============================================================================
// OPTIONS: CORS preflight
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
