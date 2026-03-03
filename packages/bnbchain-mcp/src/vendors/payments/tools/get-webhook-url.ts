/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// MCP Tool: get_webhook_url
// Returns the public webhook URL for configuring in Bitnovo Dashboard

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GetWebhookUrlInput, GetWebhookUrlOutput } from '../types/index.js';
import type { WebhookServer } from '../webhook-server.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * MCP Tool Definition: get_webhook_url
 */
export const getWebhookUrlTool: Tool = {
  name: 'get_webhook_url',
  description: `Get the public webhook URL for configuring in Bitnovo Pay Dashboard.

Returns the complete webhook URL that should be configured as the notification_url in your Bitnovo device settings. This URL includes the tunnel provider information (ngrok, zrok, or manual).

The webhook URL is automatically generated based on your execution context:
- Local development: Uses ngrok or zrok tunnel with persistent URL
- N8N/Opal/VPS: Uses the configured WEBHOOK_PUBLIC_URL
- Server environments: Auto-detects and provides appropriate URL

**Important**: After receiving this URL, configure it in Bitnovo Dashboard:
1. Log into https://pay.bitnovo.com
2. Navigate to: Settings → Merchant → Devices
3. Select your device
4. Set "notification_url" to the returned webhook_url

Optional validation check ensures the URL is publicly accessible.`,
  inputSchema: {
    type: 'object',
    properties: {
      validate: {
        type: 'boolean',
        description:
          'If true, performs a health check on the URL to verify it is publicly accessible (default: false)',
        default: false,
      },
    },
  },
};

/**
 * Handler for get_webhook_url tool
 */
export class GetWebhookUrlHandler {
  constructor(private webhookServer: WebhookServer | null) {}

  async handle(args: GetWebhookUrlInput): Promise<GetWebhookUrlOutput> {
    const startTime = Date.now();

    logger.info('get_webhook_url called', {
      validate: args.validate,
      operation: 'get_webhook_url',
    });

    try {
      // Check if webhook server exists
      if (!this.webhookServer) {
        throw new Error(
          'Webhooks are not enabled. Set WEBHOOK_ENABLED=true to use webhooks.'
        );
      }

      // Get webhook URL
      const webhookUrl = this.webhookServer.getWebhookUrl();
      if (!webhookUrl) {
        throw new Error(
          'Webhook URL not available. Tunnel may not be started or configured properly.'
        );
      }

      // Get tunnel info
      const tunnelManager = this.webhookServer.getTunnelManager();
      const tunnelInfo = tunnelManager?.getInfo();
      const provider = tunnelInfo?.provider || 'manual';

      let validated = false;
      let instructions: string | undefined;

      // Validate URL if requested
      if (args.validate) {
        try {
          const response = await fetch(webhookUrl.replace(this.webhookServer.getConfig().path, '/health'), {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });

          validated = response.ok;

          if (!validated) {
            logger.warn('Webhook URL validation failed', {
              status: response.status,
              statusText: response.statusText,
              operation: 'validate_webhook_url',
            });
          }
        } catch (error) {
          logger.warn('Webhook URL validation error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            operation: 'validate_webhook_url',
          });
          validated = false;
        }
      }

      // Generate provider-specific instructions
      switch (provider) {
        case 'ngrok':
          instructions = `✅ ngrok tunnel active with persistent URL.

Configuration steps:
1. Copy this webhook URL: ${webhookUrl}
2. Log into https://pay.bitnovo.com
3. Go to: Settings → Merchant → Devices
4. Select your device
5. Set "notification_url" to: ${webhookUrl}

Note: This ngrok URL is persistent and will not change between restarts${
            tunnelInfo?.['ngrokDomain' as keyof typeof tunnelInfo]
              ? ' (using custom domain)'
              : ' (using free static domain)'
          }.`;
          break;

        case 'zrok':
          instructions = `✅ zrok tunnel active with persistent URL.

Configuration steps:
1. Copy this webhook URL: ${webhookUrl}
2. Log into https://pay.bitnovo.com
3. Go to: Settings → Merchant → Devices
4. Select your device
5. Set "notification_url" to: ${webhookUrl}

Note: This zrok URL is persistent (reserved share) and will not change between restarts.`;
          break;

        case 'manual':
          instructions = `✅ Manual configuration (server with public IP).

Configuration steps:
1. Copy this webhook URL: ${webhookUrl}
2. Log into https://pay.bitnovo.com
3. Go to: Settings → Merchant → Devices
4. Select your device
5. Set "notification_url" to: ${webhookUrl}

Note: This is your server's public URL. Ensure your firewall allows inbound HTTPS traffic.`;
          break;
      }

      const duration = Date.now() - startTime;

      logger.info('get_webhook_url completed', {
        provider,
        validated: args.validate ? validated : 'not_checked',
        duration,
        operation: 'get_webhook_url_complete',
      });

      return {
        webhook_url: webhookUrl,
        provider,
        validated,
        instructions,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        'get_webhook_url failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          duration,
          operation: 'get_webhook_url_error',
        }
      );

      throw error;
    }
  }
}

/**
 * Factory function to create handler with webhook server reference
 */
export function getWebhookUrlHandler(
  webhookServer: WebhookServer | null
): GetWebhookUrlHandler {
  return new GetWebhookUrlHandler(webhookServer);
}