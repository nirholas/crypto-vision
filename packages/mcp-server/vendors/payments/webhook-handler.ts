/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Webhook request handler and payload processor
// Validates, processes, and stores webhook notifications from Bitnovo Pay

import { z } from 'zod';
import { validateWebhookSignature, getNonceCache } from './utils/crypto.js';
import { getEventStore, WebhookEvent } from './storage/webhook-events.js';
import { getLogger } from './utils/logger.js';
import type { Configuration } from './types/index.js';

const logger = getLogger();

/**
 * Bitnovo webhook payload schema
 * Based on PaymentSerializer from backend reference
 */
const WebhookPayloadSchema = z.object({
  identifier: z.string().uuid(),
  status: z.enum(['NR', 'PE', 'AC', 'IA', 'OC', 'CO', 'CA', 'EX', 'FA', 'RF']),
  fiat_amount: z.number().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
  created_at: z.string().optional(),
  expired_at: z.string().optional(),
  expected_input_amount: z.number().optional(),
  input_amount: z.number().optional(),
  confirmed_amount: z.number().optional(),
  unconfirmed_amount: z.number().optional(),
  crypto_amount: z.number().optional(),
  exchange_rate: z.number().optional(),
  network_fee: z.number().optional(),
  expired_time: z.string().optional(),
  address: z.string().optional(),
  tag_memo: z.string().optional(),
  input_currency: z.string().optional(),
  fiat: z.string().optional(),
  language: z.string().optional(),
  payment_uri: z.string().optional(),
  web_url: z.string().optional(),
  good_fee: z.boolean().optional(),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export interface WebhookRequest {
  headers: {
    'x-nonce'?: string;
    'x-signature'?: string;
    [key: string]: string | undefined;
  };
  body: unknown;
  rawBody: string;
}

export interface WebhookHandlerResult {
  success: boolean;
  eventId?: string;
  error?: string;
  errorCode?: string;
  statusCode: number;
}

export class WebhookHandler {
  private config: Configuration;
  private nonceCache = getNonceCache();

  constructor(config: Configuration) {
    this.config = config;

    logger.info('Webhook handler initialized', {
      hasDeviceSecret: !!config.deviceSecret,
      operation: 'webhook_handler_init',
    });
  }

  /**
   * Process an incoming webhook request
   * @param request - The webhook HTTP request
   * @returns Processing result with status code
   */
  async handle(request: WebhookRequest): Promise<WebhookHandlerResult> {
    const startTime = Date.now();

    try {
      // Step 1: Extract and validate headers
      const nonce = request.headers['x-nonce'];
      const signature = request.headers['x-signature'];

      if (!nonce || !signature) {
        logger.warn('Webhook missing required headers', {
          hasNonce: !!nonce,
          hasSignature: !!signature,
          operation: 'webhook_missing_headers',
        });

        return {
          success: false,
          error: 'Missing required headers: X-NONCE and X-SIGNATURE',
          errorCode: 'MISSING_HEADERS',
          statusCode: 400,
        };
      }

      // Step 2: Validate HMAC signature (if device secret is configured)
      let validated = false;

      if (this.config.deviceSecret) {
        const validationResult = validateWebhookSignature(
          this.config.deviceSecret,
          nonce,
          request.rawBody,
          signature
        );

        if (!validationResult.isValid) {
          logger.warn('Webhook signature validation failed', {
            error: validationResult.error,
            noncePrefix: nonce.slice(0, 8),
            operation: 'webhook_invalid_signature',
          });

          return {
            success: false,
            error: 'Invalid webhook signature',
            errorCode: 'INVALID_SIGNATURE',
            statusCode: 401,
          };
        }

        validated = true;

        logger.debug('Webhook signature validated successfully', {
          noncePrefix: nonce.slice(0, 8),
          operation: 'webhook_signature_valid',
        });
      } else {
        logger.warn('Device secret not configured, skipping signature validation', {
          operation: 'webhook_no_secret',
        });
      }

      // Step 3: Check for nonce replay attack
      const nonceAdded = this.nonceCache.add(nonce);
      if (!nonceAdded) {
        logger.warn('Webhook nonce already used (replay attack detected)', {
          noncePrefix: nonce.slice(0, 8),
          operation: 'webhook_replay_attack',
        });

        return {
          success: false,
          error: 'Nonce already used (potential replay attack)',
          errorCode: 'REPLAY_ATTACK',
          statusCode: 400,
        };
      }

      // Step 4: Parse and validate payload
      let payload: WebhookPayload;
      try {
        payload = WebhookPayloadSchema.parse(request.body);
      } catch (error) {
        logger.error('Webhook payload validation failed', error as Error, {
          operation: 'webhook_invalid_payload',
        });

        return {
          success: false,
          error: 'Invalid webhook payload format',
          errorCode: 'INVALID_PAYLOAD',
          statusCode: 400,
        };
      }

      // Step 5: Create webhook event
      const event: WebhookEvent = {
        identifier: payload.identifier,
        status: payload.status,
        receivedAt: new Date(),
        payload: request.body as Record<string, unknown>,
        signature,
        nonce,
        validated,
        eventId: this.generateEventId(payload.identifier, nonce),
      };

      // Step 6: Store event
      const eventStore = getEventStore();
      const stored = eventStore.store(event);

      if (!stored) {
        logger.warn('Webhook event not stored (duplicate or storage full)', {
          eventId: event.eventId,
          identifier: payload.identifier,
          operation: 'webhook_not_stored',
        });

        // Still return success to avoid retries from Bitnovo
        return {
          success: true,
          eventId: event.eventId,
          statusCode: 200,
        };
      }

      const duration = Date.now() - startTime;

      logger.info('Webhook processed successfully', {
        eventId: event.eventId,
        identifier: payload.identifier,
        status: payload.status,
        validated,
        duration,
        operation: 'webhook_success',
      });

      return {
        success: true,
        eventId: event.eventId,
        statusCode: 200,
      };
    } catch (error) {
      logger.error('Webhook processing error', error as Error, {
        operation: 'webhook_error',
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        error: 'Internal server error processing webhook',
        errorCode: 'INTERNAL_ERROR',
        statusCode: 500,
      };
    }
  }

  /**
   * Generate a unique event ID from identifier and nonce
   * @param identifier - Payment identifier
   * @param nonce - Webhook nonce
   * @returns Unique event ID
   */
  private generateEventId(identifier: string, nonce: string): string {
    // Use identifier + nonce for deduplication
    // Format: identifier:nonce
    return `${identifier}:${nonce}`;
  }

  /**
   * Get webhook handler statistics
   */
  getStats(): {
    noncesCached: number;
    hasDeviceSecret: boolean;
  } {
    return {
      noncesCached: this.nonceCache.size(),
      hasDeviceSecret: !!this.config.deviceSecret,
    };
  }
}

/**
 * Create a webhook handler instance
 * @param config - Server configuration
 * @returns WebhookHandler instance
 */
export function createWebhookHandler(config: Configuration): WebhookHandler {
  return new WebhookHandler(config);
}