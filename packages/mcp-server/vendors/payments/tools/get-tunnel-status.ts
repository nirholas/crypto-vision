/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// MCP Tool: get_tunnel_status
// Returns detailed status of the tunnel connection

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GetTunnelStatusOutput } from '../types/index.js';
import type { WebhookServer } from '../webhook-server.js';
import { getLogger } from '../utils/logger.js';
import { detectContext } from '../tunnel/context-detector.js';

const logger = getLogger();

/**
 * MCP Tool Definition: get_tunnel_status
 */
export const getTunnelStatusTool: Tool = {
  name: 'get_tunnel_status',
  description: `Get detailed status and diagnostics of the webhook tunnel connection.

Returns comprehensive information about the tunnel provider, connection status, public URL, health monitoring, and execution context detection.

Useful for:
- Troubleshooting connectivity issues
- Verifying tunnel is active before creating payments
- Understanding which provider is being used (ngrok, zrok, or manual)
- Checking if auto-reconnect is working
- Seeing detected execution context (N8N, Opal, VPS, Docker, local)

Connection statuses:
- disconnected: Tunnel not started
- connecting: Tunnel is initializing
- connected: Tunnel is active and healthy
- reconnecting: Tunnel lost connection and is attempting to reconnect
- error: Tunnel failed after max reconnection attempts

No input parameters required - returns current status immediately.`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

/**
 * Handler for get_tunnel_status tool
 */
export class GetTunnelStatusHandler {
  constructor(private webhookServer: WebhookServer | null) {}

  async handle(_args: Record<string, never>): Promise<GetTunnelStatusOutput> {
    const startTime = Date.now();

    logger.info('get_tunnel_status called', {
      operation: 'get_tunnel_status',
    });

    try {
      // Check if webhook server exists
      if (!this.webhookServer) {
        return {
          enabled: false,
          provider: 'manual',
          status: 'disconnected',
          public_url: null,
          connected_at: null,
          last_error: 'Webhooks are not enabled',
          reconnect_attempts: 0,
          health_check_enabled: false,
        };
      }

      // Get tunnel manager
      const tunnelManager = this.webhookServer.getTunnelManager();

      if (!tunnelManager) {
        return {
          enabled: false,
          provider: 'manual',
          status: 'disconnected',
          public_url: null,
          connected_at: null,
          last_error: 'Tunnel is not enabled',
          reconnect_attempts: 0,
          health_check_enabled: false,
        };
      }

      // Get tunnel info
      const tunnelInfo = tunnelManager.getInfo();

      if (!tunnelInfo) {
        return {
          enabled: false,
          provider: 'manual',
          status: 'disconnected',
          public_url: null,
          connected_at: null,
          last_error: 'Tunnel info not available',
          reconnect_attempts: 0,
          health_check_enabled: false,
        };
      }

      // Detect execution context
      const contextDetection = detectContext();

      const duration = Date.now() - startTime;

      logger.info('get_tunnel_status completed', {
        provider: tunnelInfo.provider,
        status: tunnelInfo.status,
        hasPublicUrl: !!tunnelInfo.publicUrl,
        duration,
        operation: 'get_tunnel_status_complete',
      });

      return {
        enabled: true,
        provider: tunnelInfo.provider,
        status: tunnelInfo.status,
        public_url: tunnelInfo.publicUrl,
        connected_at: tunnelInfo.connectedAt
          ? tunnelInfo.connectedAt.toISOString()
          : null,
        last_error: tunnelInfo.lastError,
        reconnect_attempts: tunnelInfo.reconnectAttempts,
        health_check_enabled: tunnelInfo.healthCheckEnabled,
        context_detected: {
          execution_context: contextDetection.context,
          confidence: contextDetection.confidence,
          suggested_provider: contextDetection.suggestedProvider,
          indicators: contextDetection.indicators,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        'get_tunnel_status failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          duration,
          operation: 'get_tunnel_status_error',
        }
      );

      throw error;
    }
  }
}

/**
 * Factory function to create handler with webhook server reference
 */
export function getTunnelStatusHandler(
  webhookServer: WebhookServer | null
): GetTunnelStatusHandler {
  return new GetTunnelStatusHandler(webhookServer);
}